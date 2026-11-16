import {
  QUIZ_TEXT_MAX_CHARS,
  QUIZ_TEXT_MIN_CHARS,
  countQuizTextChars,
} from '@/shared/constants/quiz-text-source';
import { docxText } from './docx';
import { pptxText } from './pptx';
import {
  OFFICE_MAX_FILE_BYTES,
  OFFICE_MAX_UNZIPPED_BYTES,
  type OfficeFileType,
  type OfficeTextResult,
} from './types';

export type { OfficeFileType, OfficeRejectReason, OfficeTextResult } from './types';
export { OFFICE_MAX_FILE_BYTES } from './types';

const PPTX_PART =
  /^ppt\/(?:presentation\.xml|_rels\/presentation\.xml\.rels|slides\/slide\d+\.xml|slides\/_rels\/slide\d+\.xml\.rels|notesSlides\/notesSlide\d+\.xml)$/;
const DOCX_PART = /^word\/document\.xml$/;

const ZIP_MAGIC = [0x50, 0x4b];
/** Compound File Binary header: how Office stores a password-protected .docx/.pptx. */
const OLE_MAGIC = [0xd0, 0xcf, 0x11, 0xe0];

function extensionOf(file: File): string {
  const name = file.name.toLowerCase();
  return name.slice(name.lastIndexOf('.') + 1);
}

/**
 * The Office type by extension, for a cheap check before anything is read.
 * @public Used by the upload surfaces that follow in RIN-1781.
 */
export function officeFileType(file: File): OfficeFileType | null {
  const ext = extensionOf(file);
  return ext === 'docx' || ext === 'pptx' ? ext : null;
}

function startsWith(bytes: Uint8Array, magic: number[]): boolean {
  return magic.every((byte, index) => bytes[index] === byte);
}

/** Only the XML parts we read are inflated; media is skipped and the declared size is capped. */
async function readParts(
  bytes: Uint8Array,
  wanted: RegExp,
): Promise<ReadonlyMap<string, Uint8Array> | null> {
  const { unzipSync } = await import('fflate');
  let declared = 0;
  let tooBig = false;
  try {
    const entries = unzipSync(bytes, {
      filter: (info) => {
        if (!wanted.test(info.name)) return false;
        declared += info.originalSize;
        if (declared > OFFICE_MAX_UNZIPPED_BYTES) tooBig = true;
        return !tooBig;
      },
    });
    return tooBig ? null : new Map(Object.entries(entries));
  } catch {
    return null;
  }
}

function finish(text: string, fileType: OfficeFileType): OfficeTextResult {
  const cleaned = text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (countQuizTextChars(cleaned) < QUIZ_TEXT_MIN_CHARS) {
    return { ok: false, reason: 'too_little_text' };
  }
  const points = Array.from(cleaned);
  if (points.length <= QUIZ_TEXT_MAX_CHARS) {
    return { ok: true, text: cleaned, fileType, truncated: false };
  }
  const trimmed = points.slice(0, QUIZ_TEXT_MAX_CHARS).join('').trimEnd();
  return { ok: true, text: trimmed, fileType, truncated: true };
}

/**
 * Read the text of a .docx or .pptx in the browser; the file is never uploaded. fflate is
 * imported on first use so it stays out of the initial bundle. Never logs the text or name.
 * @public Used by the upload surfaces that follow in RIN-1781.
 */
export async function extractOfficeText(file: File): Promise<OfficeTextResult> {
  const ext = extensionOf(file);
  if (ext === 'doc' || ext === 'ppt') return { ok: false, reason: 'legacy_format' };
  const fileType = officeFileType(file);
  if (!fileType) return { ok: false, reason: 'wrong_type' };
  if (file.size > OFFICE_MAX_FILE_BYTES) return { ok: false, reason: 'too_large' };

  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch {
    return { ok: false, reason: 'corrupt' };
  }
  if (startsWith(bytes, OLE_MAGIC)) return { ok: false, reason: 'encrypted' };
  if (!startsWith(bytes, ZIP_MAGIC)) return { ok: false, reason: 'corrupt' };

  const parts = await readParts(bytes, fileType === 'pptx' ? PPTX_PART : DOCX_PART);
  if (!parts) return { ok: false, reason: 'corrupt' };

  if (fileType === 'pptx') {
    const result = pptxText(parts);
    return 'corrupt' in result ? { ok: false, reason: 'corrupt' } : finish(result.text, fileType);
  }
  const document = parts.get('word/document.xml');
  const text = document ? docxText(document) : null;
  return text === null ? { ok: false, reason: 'corrupt' } : finish(text, fileType);
}
