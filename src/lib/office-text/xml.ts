/** Small DOM helpers over the XML parts of an Office file. Namespace prefixes vary, so match local names. */

export function parseXml(bytes: Uint8Array): Document | null {
  const text = new TextDecoder('utf-8').decode(bytes);
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  return doc.getElementsByTagName('parsererror').length > 0 ? null : doc;
}

export function childElements(parent: Element, localName?: string): Element[] {
  return Array.from(parent.children).filter(
    (child) => localName === undefined || child.localName === localName,
  );
}

export function descendants(parent: Document | Element, localName: string): Element[] {
  return Array.from(parent.getElementsByTagNameNS('*', localName));
}

export function normalizeSpace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * The text of one paragraph (`a:p` or `w:p`): runs (`t`), tabs and line breaks in order.
 * `mc:Fallback` repeats what `mc:Choice` already holds, so it is skipped.
 */
export function paragraphText(paragraph: Element, lineBreak: string): string {
  let out = '';
  const walk = (node: Element): void => {
    for (const child of Array.from(node.children)) {
      switch (child.localName) {
        case 't':
          out += child.textContent;
          break;
        case 'tab':
          out += '\t';
          break;
        case 'br':
        case 'cr':
          out += lineBreak;
          break;
        case 'Fallback':
          break;
        default:
          walk(child);
      }
    }
  };
  walk(paragraph);
  return out;
}

/** Resolve a relationship target against the directory of the part that declares it. */
export function resolvePartPath(baseDir: string, target: string): string {
  const parts = target.startsWith('/') ? [] : baseDir.split('/').filter(Boolean);
  for (const segment of target.split('/')) {
    if (segment === '..') parts.pop();
    else if (segment !== '' && segment !== '.') parts.push(segment);
  }
  return parts.join('/');
}

/** Table rows on lines, cells joined by " | "; a row with only empty cells is dropped. */
export function tableText(table: Element, cellParagraphs: (cell: Element) => Element[]): string {
  const rows: string[] = [];
  for (const row of childElements(table, 'tr')) {
    const cells = childElements(row, 'tc').map((cell) =>
      normalizeSpace(
        cellParagraphs(cell)
          .map((p) => paragraphText(p, ' '))
          .join(' '),
      ),
    );
    if (cells.some(Boolean)) rows.push(cells.join(' | '));
  }
  return rows.join('\n');
}
