import { QUIZ_TEXT_MAX_CHARS } from '@/shared/constants/quiz-text-source';
import {
  childElements,
  descendants,
  normalizeSpace,
  paragraphText,
  parseXml,
  resolvePartPath,
  tableText,
} from './xml';

const REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const SKIPPED_PLACEHOLDERS = new Set(['sldNum', 'dt', 'ftr', 'hdr']);
/** Enough code units that the code-point trim is sure to cut, so we stop reading slides. */
const STOP_AFTER_UNITS = QUIZ_TEXT_MAX_CHARS * 2;
const SLIDE_PATH = /^ppt\/slides\/slide(\d+)\.xml$/;

export type PptxParts = ReadonlyMap<string, Uint8Array>;

type SlideContent = { title: string; body: string[] };
type Relationship = { id: string; type: string; path: string };

function placeholderType(shape: Element): string | null {
  const ph = descendants(shape, 'ph')[0];
  return ph ? (ph.getAttribute('type') ?? 'body') : null;
}

function shapeParagraphs(shape: Element): string[] {
  return childElements(shape, 'txBody').flatMap((txBody) =>
    childElements(txBody, 'p')
      .map((p) => paragraphText(p, '\n').trim())
      .filter(Boolean),
  );
}

function cellParagraphs(cell: Element): Element[] {
  return childElements(cell, 'txBody').flatMap((txBody) => childElements(txBody, 'p'));
}

function collectShapes(parent: Element, content: SlideContent): void {
  for (const child of Array.from(parent.children)) {
    switch (child.localName) {
      case 'sp': {
        const type = placeholderType(child);
        if (type !== null && SKIPPED_PLACEHOLDERS.has(type)) break;
        const lines = shapeParagraphs(child);
        if (type === 'title' || type === 'ctrTitle') {
          const title = normalizeSpace(lines.join(' '));
          if (title) content.title = content.title ? `${content.title} ${title}` : title;
        } else {
          content.body.push(...lines);
        }
        break;
      }
      case 'graphicFrame':
        for (const table of descendants(child, 'tbl')) {
          const text = tableText(table, cellParagraphs);
          if (text) content.body.push(text);
        }
        break;
      case 'Fallback':
        break;
      default:
        // Group shapes and mc:AlternateContent hold more shapes.
        collectShapes(child, content);
    }
  }
}

function slideContent(xml: Uint8Array): SlideContent | null {
  const doc = parseXml(xml);
  const tree = doc ? descendants(doc, 'spTree')[0] : undefined;
  if (!tree) return null;
  const content: SlideContent = { title: '', body: [] };
  collectShapes(tree, content);
  return content;
}

function notesText(xml: Uint8Array): string {
  const doc = parseXml(xml);
  if (!doc) return '';
  return descendants(doc, 'sp')
    .filter((shape) => placeholderType(shape) === 'body')
    .flatMap(shapeParagraphs)
    .join('\n');
}

function relationships(parts: PptxParts, relsPath: string, baseDir: string): Relationship[] {
  const bytes = parts.get(relsPath);
  const doc = bytes ? parseXml(bytes) : null;
  if (!doc) return [];
  return descendants(doc, 'Relationship').map((rel) => ({
    id: rel.getAttribute('Id') ?? '',
    type: rel.getAttribute('Type') ?? '',
    path: resolvePartPath(baseDir, rel.getAttribute('Target') ?? ''),
  }));
}

/** Slide parts in deck order: `presentation.xml` says it, the slide number is the fallback. */
function orderedSlidePaths(parts: PptxParts): string[] {
  const numeric = [...parts.keys()]
    .filter((name) => SLIDE_PATH.test(name))
    .sort((a, b) => Number(SLIDE_PATH.exec(a)?.[1]) - Number(SLIDE_PATH.exec(b)?.[1]));
  const presentation = parts.get('ppt/presentation.xml');
  const doc = presentation ? parseXml(presentation) : null;
  if (!doc) return numeric;
  const byId = new Map(
    relationships(parts, 'ppt/_rels/presentation.xml.rels', 'ppt').map((rel) => [rel.id, rel.path]),
  );
  const ordered = descendants(doc, 'sldId')
    .map((slide) => byId.get(slide.getAttributeNS(REL_NS, 'id') ?? ''))
    .filter((path): path is string => path !== undefined && parts.has(path));
  return ordered.length > 0 ? ordered : numeric;
}

function slideNotes(parts: PptxParts, slidePath: string): string {
  const cut = slidePath.lastIndexOf('/');
  const dir = slidePath.slice(0, cut);
  const rel = relationships(parts, `${dir}/_rels/${slidePath.slice(cut + 1)}.rels`, dir).find((r) =>
    r.type.endsWith('/notesSlide'),
  );
  const bytes = rel ? parts.get(rel.path) : undefined;
  return bytes ? notesText(bytes) : '';
}

export type PptxText = { text: string } | { corrupt: true };

/**
 * `Slide N: <title>`, the body, then `Notes: <notes>`, one block per slide in deck order.
 * N is the slide's position in the deck, so an empty slide leaves a gap in the numbering.
 * Corrupt means no slide part, or one that does not parse.
 */
export function pptxText(parts: PptxParts): PptxText {
  const paths = orderedSlidePaths(parts);
  if (paths.length === 0) return { corrupt: true };
  const blocks: string[] = [];
  let units = 0;
  for (const [index, path] of paths.entries()) {
    const bytes = parts.get(path);
    const content = bytes ? slideContent(bytes) : null;
    if (!content) return { corrupt: true };
    const notes = slideNotes(parts, path);
    if (!content.title && content.body.length === 0 && !notes) continue;
    const head = `Slide ${index + 1}:${content.title ? ` ${content.title}` : ''}`;
    const lines = [head, ...content.body];
    if (notes) lines.push(`Notes: ${notes}`);
    const block = lines.join('\n');
    blocks.push(block);
    units += block.length;
    if (units > STOP_AFTER_UNITS) break;
  }
  return { text: blocks.join('\n\n') };
}
