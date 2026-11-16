import type { Accept } from 'react-dropzone';

import { isPdfFile } from '@/features/quiz/components/create/pdf-file-error';
import {
  OFFICE_MAX_FILE_BYTES,
  extractOfficeText,
  type OfficeFileType,
  type OfficeRejectReason,
} from '@/lib/office-text';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
const DOC_MIME = 'application/msword';
const PPT_MIME = 'application/vnd.ms-powerpoint';

/**
 * What the /create/pdf file pickers offer (RIN-1787): PDF, .docx and .pptx by MIME and by
 * extension (a phone may send an empty type), plus .doc and .ppt so a legacy file reaches the
 * "save it as .docx or PDF" message instead of being greyed out in the picker.
 */
export const CREATE_FILE_ACCEPT: Accept = {
  'application/pdf': ['.pdf'],
  [DOCX_MIME]: ['.docx'],
  [PPTX_MIME]: ['.pptx'],
  [DOC_MIME]: ['.doc'],
  [PPT_MIME]: ['.ppt'],
};

/** The size limit of a Word or PowerPoint file, in MB, for the hint and the too-large message. */
export const OFFICE_MAX_FILE_MB = OFFICE_MAX_FILE_BYTES / (1024 * 1024);

/** Where an uploaded file is read: PDFs go to storage, Word and PowerPoint are read in the browser. */
export type CreateFileKind = 'pdf' | 'office' | 'legacy' | 'other';

function extensionOf(file: Pick<File, 'name'>): string {
  const name = file.name.toLowerCase();
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot + 1);
}

function officeTypeOf(file: Pick<File, 'name' | 'type'>): OfficeFileType | null {
  const ext = extensionOf(file);
  if (ext === 'docx' || ext === 'pptx') return ext;
  if (file.type === DOCX_MIME) return 'docx';
  return file.type === PPTX_MIME ? 'pptx' : null;
}

export function createFileKind(file: File): CreateFileKind {
  const ext = extensionOf(file);
  if (ext === 'doc' || ext === 'ppt' || file.type === DOC_MIME || file.type === PPT_MIME) {
    return 'legacy';
  }
  if (isPdfFile(file)) return 'pdf';
  return officeTypeOf(file) ? 'office' : 'other';
}

/** The default quiz title: the file name without its PDF, Word or PowerPoint extension. */
export function titleFromFileName(name: string): string {
  return name.replace(/\.(pdf|docx|pptx)$/i, '');
}

/** The text of a Word or PowerPoint file, as the text draft route takes it. */
export interface OfficeSource {
  text: string;
  fileType: OfficeFileType;
  /** The file had more text than a draft takes; only the first characters were kept. */
  truncated: boolean;
}

export type OfficeReadResult =
  { ok: true; source: OfficeSource } | { ok: false; reason: OfficeRejectReason };

/**
 * Reads a .docx or .pptx in the browser; nothing is uploaded. A legacy .doc or .ppt, or any
 * other file, is refused with its reason (`legacy_format`, `wrong_type`). Extraction goes by file
 * extension, so a file the phone named without one is read under a name that ends in its type.
 */
export async function readOfficeFile(file: File): Promise<OfficeReadResult> {
  if (createFileKind(file) === 'legacy') return { ok: false, reason: 'legacy_format' };
  const fileType = officeTypeOf(file);
  const readable =
    fileType && extensionOf(file) !== fileType
      ? new File([file], `${file.name}.${fileType}`, { type: file.type })
      : file;
  const result = await extractOfficeText(readable);
  if (!result.ok) return { ok: false, reason: result.reason };
  return {
    ok: true,
    source: { text: result.text, fileType: result.fileType, truncated: result.truncated },
  };
}

type CreateTranslator = (key: string, values?: Record<string, string | number>) => string;

/** Copy for a Word or PowerPoint file the browser refused, from the `create` message keys. */
export function getOfficeRefusalMessage(
  reason: OfficeRejectReason,
  t: CreateTranslator,
  maxSizeMb: number,
): string {
  switch (reason) {
    case 'too_large':
      return t('officeTooLarge', { size: maxSizeMb });
    case 'legacy_format':
      return t('officeLegacyFormat');
    case 'encrypted':
      return t('officeEncrypted');
    case 'corrupt':
      return t('officeCorrupt');
    case 'too_little_text':
      return t('officeTooLittleText');
    case 'wrong_type':
      return t('pdfWrongType');
  }
}
