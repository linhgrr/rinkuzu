// @vitest-environment jsdom
import { strToU8 as encode, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { extractOfficeText, officeFileType } from '@/lib/office-text';

// Under jsdom the encoder returns another realm's Uint8Array, which zipSync reads as a folder.
const strToU8 = (text: string): Uint8Array => Uint8Array.from(encode(text));

const NS =
  'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
  'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" ' +
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const W_NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const REL_PKG = 'http://schemas.openxmlformats.org/package/2006/relationships';
const REL_TYPE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

const FILLER = 'Fake filler sentence about photosynthesis in leaves and light. '.repeat(4);

function paragraphs(...lines: string[]): string {
  return lines.map((line) => `<a:p><a:r><a:t>${line}</a:t></a:r></a:p>`).join('');
}

function shape(type: string | null, ...lines: string[]): string {
  const ph = type ? `<p:ph type="${type}"/>` : '';
  return `<p:sp><p:nvSpPr><p:cNvPr id="1" name="s"/><p:cNvSpPr/><p:nvPr>${ph}</p:nvPr></p:nvSpPr><p:txBody>${paragraphs(...lines)}</p:txBody></p:sp>`;
}

function table(rows: string[][]): string {
  const trs = rows
    .map(
      (row) =>
        `<a:tr>${row.map((cell) => `<a:tc><a:txBody>${paragraphs(cell)}</a:txBody></a:tc>`).join('')}</a:tr>`,
    )
    .join('');
  return `<p:graphicFrame><a:graphic><a:graphicData><a:tbl>${trs}</a:tbl></a:graphicData></a:graphic></p:graphicFrame>`;
}

function slide(...shapes: string[]): Uint8Array {
  return strToU8(
    `<?xml version="1.0"?><p:sld ${NS}><p:cSld><p:spTree>${shapes.join('')}</p:spTree></p:cSld></p:sld>`,
  );
}

function notes(text: string): Uint8Array {
  return strToU8(
    `<?xml version="1.0"?><p:notes ${NS}><p:cSld><p:spTree>${shape('sldImg')}${shape('body', text)}${shape('sldNum', '7')}</p:spTree></p:cSld></p:notes>`,
  );
}

function rels(entries: { id: string; type: string; target: string }[]): Uint8Array {
  const items = entries
    .map((e) => `<Relationship Id="${e.id}" Type="${REL_TYPE}/${e.type}" Target="${e.target}"/>`)
    .join('');
  return strToU8(`<?xml version="1.0"?><Relationships xmlns="${REL_PKG}">${items}</Relationships>`);
}

function presentation(rIds: string[]): Uint8Array {
  const ids = rIds.map((id, i) => `<p:sldId id="${256 + i}" r:id="${id}"/>`).join('');
  return strToU8(
    `<?xml version="1.0"?><p:presentation ${NS}><p:sldIdLst>${ids}</p:sldIdLst></p:presentation>`,
  );
}

function fileOf(entries: Record<string, Uint8Array>, name: string): File {
  const bytes = zipSync(entries, { level: 1 });
  return new File([bytes as BlobPart], name);
}

function threeSlideDeck(): Record<string, Uint8Array> {
  return {
    'ppt/presentation.xml': presentation(['rId2', 'rId1', 'rId3']),
    'ppt/_rels/presentation.xml.rels': rels([
      { id: 'rId1', type: 'slide', target: 'slides/slide1.xml' },
      { id: 'rId2', type: 'slide', target: 'slides/slide2.xml' },
      { id: 'rId3', type: 'slide', target: '/ppt/slides/slide3.xml' },
    ]),
    // slide2 comes first in the deck although slide1.xml is the lower number
    'ppt/slides/slide2.xml': slide(
      shape('ctrTitle', 'Cell biology'),
      shape('subTitle', 'An overview of the cell'),
      shape('sldNum', '1'),
      shape('dt', '1 Jan'),
    ),
    'ppt/slides/slide1.xml': slide(
      shape(null, FILLER),
      shape('title', 'Organelles'),
      shape('body', 'Nucleus holds the DNA', 'Mitochondria make ATP'),
      table([
        ['Organelle', 'Job'],
        ['Ribosome', 'Builds protein'],
      ]),
    ),
    'ppt/slides/_rels/slide1.xml.rels': rels([
      { id: 'rId1', type: 'notesSlide', target: '../notesSlides/notesSlide1.xml' },
    ]),
    'ppt/notesSlides/notesSlide1.xml': notes('Mention the textbook chapter'),
    'ppt/slides/slide3.xml': slide(shape('title', 'Summary'), shape('body', FILLER)),
    'ppt/media/image1.png': new Uint8Array([1, 2, 3]),
  };
}

describe('extractOfficeText: pptx', () => {
  it('orders slides by presentation.xml and keeps title, body, table and notes in order', async () => {
    const result = await extractOfficeText(fileOf(threeSlideDeck(), 'deck.PPTX'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fileType).toBe('pptx');
    expect(result.truncated).toBe(false);
    const text = result.text;
    expect(
      text.startsWith('Slide 1: Cell biology\nAn overview of the cell\n\nSlide 2: Organelles\n'),
    ).toBe(true);
    expect(text).toContain(
      `Slide 2: Organelles\n${FILLER.trim()}\nNucleus holds the DNA\nMitochondria make ATP\nOrganelle | Job\nRibosome | Builds protein\nNotes: Mention the textbook chapter`,
    );
    expect(text.indexOf('Slide 2:')).toBeLessThan(text.indexOf('Slide 3: Summary'));
    expect(text).not.toContain('1 Jan');
    expect(text).not.toMatch(/Notes: .*7/);
  });

  it('falls back to slide number order without presentation.xml and skips empty slides', async () => {
    const entries = threeSlideDeck();
    delete entries['ppt/presentation.xml'];
    delete entries['ppt/_rels/presentation.xml.rels'];
    entries['ppt/slides/slide4.xml'] = slide(shape('sldNum', '4'));
    const result = await extractOfficeText(fileOf(entries, 'deck.pptx'));
    expect(result.ok && result.text.startsWith('Slide 1: Organelles')).toBe(true);
    expect(result.ok && result.text).not.toContain('Slide 4');
  });

  it('rejects an image-only deck as too_little_text', async () => {
    const pic = '<p:pic><p:nvPicPr><p:cNvPr id="2" name="p"/></p:nvPicPr></p:pic>';
    const result = await extractOfficeText(
      fileOf(
        { 'ppt/slides/slide1.xml': slide(pic), 'ppt/media/image1.png': new Uint8Array(9) },
        'deck.pptx',
      ),
    );
    expect(result).toEqual({ ok: false, reason: 'too_little_text' });
  });

  it('rejects a deck with no slide part or broken XML as corrupt', async () => {
    expect(
      await extractOfficeText(fileOf({ 'ppt/media/a.png': new Uint8Array(3) }, 'a.pptx')),
    ).toEqual({
      ok: false,
      reason: 'corrupt',
    });
    const broken = { 'ppt/slides/slide1.xml': strToU8('<p:sld><p:cSld>') };
    expect(await extractOfficeText(fileOf(broken, 'a.pptx'))).toEqual({
      ok: false,
      reason: 'corrupt',
    });
  });

  it('rejects an oversized declared entry as corrupt although its XML is valid', async () => {
    // Valid slide plus 31 MB of trailing whitespace: only the size guard can refuse it.
    const valid = slide(shape('title', 'Big'), shape('body', FILLER));
    const padded = new Uint8Array(valid.length + 31 * 1024 * 1024).fill(32);
    padded.set(valid);
    const result = await extractOfficeText(fileOf({ 'ppt/slides/slide1.xml': padded }, 'a.pptx'));
    expect(result).toEqual({ ok: false, reason: 'corrupt' });
    const small = await extractOfficeText(fileOf({ 'ppt/slides/slide1.xml': valid }, 'a.pptx'));
    expect(small.ok).toBe(true);
  });
});

describe('extractOfficeText: docx', () => {
  const docx = (body: string) =>
    fileOf(
      {
        'word/document.xml': strToU8(
          `<?xml version="1.0"?><w:document ${W_NS}><w:body>${body}</w:body></w:document>`,
        ),
      },
      'notes.docx',
    );
  const p = (...runs: string[]) => `<w:p><w:r>${runs.join('</w:r><w:r>')}</w:r></w:p>`;
  const t = (text: string) => `<w:t>${text}</w:t>`;

  it('reads paragraphs, tabs, breaks and tables in order', async () => {
    const cell = (text: string) => `<w:tc>${p(t(text))}</w:tc>`;
    const result = await extractOfficeText(
      docx(
        p(t('Heading one')) +
          p(t('Column'), '<w:tab/>', t('two'), '<w:br/>', t('next line')) +
          `<w:tbl><w:tr>${cell('Term')}${cell('Meaning')}</w:tr><w:tr>${cell('Atom')}${cell('Smallest unit')}</w:tr></w:tbl>` +
          p(t(FILLER)),
      ),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fileType).toBe('docx');
    expect(result.text).toBe(
      `Heading one\nColumn\ttwo\nnext line\nTerm | Meaning\nAtom | Smallest unit\n${FILLER.trim()}`,
    );
  });

  it('trims to 20,000 code points and reports truncated', async () => {
    const result = await extractOfficeText(docx(p(t('😀'.repeat(25_000)))));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.truncated).toBe(true);
    expect(Array.from(result.text)).toHaveLength(20_000);
  });

  it('keeps text of exactly the floor and refuses one below it', async () => {
    expect((await extractOfficeText(docx(p(t('a'.repeat(200)))))).ok).toBe(true);
    expect(await extractOfficeText(docx(p(t('a'.repeat(199)))))).toEqual({
      ok: false,
      reason: 'too_little_text',
    });
  });

  it('rejects a docx without document.xml as corrupt', async () => {
    expect(
      await extractOfficeText(fileOf({ 'word/styles.xml': strToU8('<a/>') }, 'a.docx')),
    ).toEqual({
      ok: false,
      reason: 'corrupt',
    });
  });
});

describe('extractOfficeText: rejected files', () => {
  it('names each reason', async () => {
    const ole = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0, 0, 0, 0]);
    expect(await extractOfficeText(new File([ole as BlobPart], 'locked.pptx'))).toEqual({
      ok: false,
      reason: 'encrypted',
    });
    expect(await extractOfficeText(new File([ole as BlobPart], 'locked.docx'))).toEqual({
      ok: false,
      reason: 'encrypted',
    });
    expect(await extractOfficeText(new File([ole as BlobPart], 'old.ppt'))).toEqual({
      ok: false,
      reason: 'legacy_format',
    });
    expect(await extractOfficeText(new File([ole as BlobPart], 'old.DOC'))).toEqual({
      ok: false,
      reason: 'legacy_format',
    });
    expect(
      await extractOfficeText(new File([new Uint8Array([9, 8, 7, 6, 5]) as BlobPart], 'x.docx')),
    ).toEqual({
      ok: false,
      reason: 'corrupt',
    });
    expect(await extractOfficeText(new File(['hello'], 'x.txt'))).toEqual({
      ok: false,
      reason: 'wrong_type',
    });
    expect(await extractOfficeText(new File(['hello'], 'noextension'))).toEqual({
      ok: false,
      reason: 'wrong_type',
    });
  });

  it('refuses a file over 20 MB before reading it', async () => {
    const big = new File(['x'], 'big.pptx');
    Object.defineProperty(big, 'size', { value: 20 * 1024 * 1024 + 1 });
    expect(await extractOfficeText(big)).toEqual({ ok: false, reason: 'too_large' });
  });

  it('tells Office files from other files by extension', () => {
    expect(officeFileType(new File([], 'a.DOCX'))).toBe('docx');
    expect(officeFileType(new File([], 'a.pptx'))).toBe('pptx');
    expect(officeFileType(new File([], 'a.pdf'))).toBeNull();
    expect(officeFileType(new File([], 'a.ppt'))).toBeNull();
  });
});
