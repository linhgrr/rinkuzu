import { descendants, paragraphText, parseXml, tableText } from './xml';

/** Walk the body in order; content controls (`w:sdt`) wrap paragraphs and tables too. */
function collectBlocks(parent: Element, out: string[]): void {
  for (const child of Array.from(parent.children)) {
    if (child.localName === 'p') {
      const text = paragraphText(child, '\n').trim();
      if (text) out.push(text);
    } else if (child.localName === 'tbl') {
      const text = tableText(child, (cell) => descendants(cell, 'p'));
      if (text) out.push(text);
    } else if (child.localName === 'sdt' || child.localName === 'sdtContent') {
      collectBlocks(child, out);
    }
  }
}

/** The text of `word/document.xml`, or null when it does not parse or has no body. */
export function docxText(documentXml: Uint8Array): string | null {
  const doc = parseXml(documentXml);
  const body = doc ? descendants(doc, 'body')[0] : undefined;
  if (!body) return null;
  const blocks: string[] = [];
  collectBlocks(body, blocks);
  return blocks.join('\n');
}
