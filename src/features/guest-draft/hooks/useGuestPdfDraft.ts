'use client';

import { useState } from 'react';
import {
  classifyGuestDraftError,
  createGuestDraft,
  createGuestTextDraft,
} from '@/features/guest-draft/api/guest-draft-api';
import { useGuestDraftRun } from '@/features/guest-draft/hooks/useGuestDraftRun';
import {
  checkGuestPdf,
  guestOfficeFile,
  type GuestPdfCheck,
} from '@/features/guest-draft/lib/check-guest-pdf';
import {
  classifyGuestOfficeError,
  GuestOfficeRefusal,
} from '@/features/guest-draft/lib/guest-office-draft';
import {
  guestDraftEntryFromSearch,
  resolveGuestDraftEntry,
} from '@/features/guest-draft/lib/resolve-guest-entry';
import { reportUploadRejection } from '@/lib/upload-rejection-client';
import type { GuestDraftOfficeSurface } from '@/shared/constants/guest-draft';
import { ROUTES } from '@/shared/constants/routes';
import type { UploadRejectionReason } from '@/shared/constants/upload-counters';

/** Browser-check refusals as counted reasons (RIN-1785). */
const GUEST_CHECK_REASON: Record<Exclude<GuestPdfCheck, 'ok'>, UploadRejectionReason> = {
  not_pdf: 'wrong_type',
  too_large: 'too_large',
  office_too_large: 'too_large',
  legacy_format: 'legacy_format',
};

/**
 * The guest upload flow (RIN-1448): browser checks, then the shared guest draft run
 * (upload, progress polling and the handoff to the guest player). The entry is the page's
 * known `?entry=`, else the referrer's, read at upload time (RIN-1645).
 *
 * A Word or PowerPoint file (RIN-1786) is never uploaded: on submit its text is read in the
 * browser and goes through the text draft route with its file type, under the same
 * "uploading" state. Such a draft is a text draft, so it opens in the text player.
 * `surface` is the page this runs on, for the refusal and office-draft counters.
 */
export function useGuestPdfDraft(surface: GuestDraftOfficeSurface = 'try_pdf') {
  const [office, setOffice] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const { state, dispatch, start, cancel, playNow } = useGuestDraftRun(
    office ? ROUTES.TRY_TEXT_PLAY : ROUTES.TRY_PDF_PLAY,
  );

  const choose = async (file: File | undefined) => {
    if (!file) return;
    setTruncated(false);
    dispatch({ type: 'check_started', file });
    const result = await checkGuestPdf(file);
    if (result !== 'ok') {
      reportUploadRejection({ file, reason: GUEST_CHECK_REASON[result], surface });
    }
    dispatch({ type: 'check_finished', file, result });
  };

  const entry = () =>
    resolveGuestDraftEntry(
      guestDraftEntryFromSearch(window.location.search),
      document.referrer,
      surface === 'try_slides' ? 'try_slides' : undefined,
    );

  const submitOffice = (source: NonNullable<ReturnType<typeof guestOfficeFile>>, file: File) =>
    start(async (token, locale) => {
      // Loaded on first use: the parser stays out of the page's first bundle.
      const { extractOfficeText } = await import('@/lib/office-text');
      const extracted = await extractOfficeText(source.file);
      if (!extracted.ok) {
        reportUploadRejection({ file, reason: extracted.reason, surface });
        throw new GuestOfficeRefusal(extracted.reason);
      }
      setTruncated(extracted.truncated);
      return createGuestTextDraft({
        text: extracted.text,
        token,
        locale,
        entry: entry(),
        sourceFileType: extracted.fileType,
        surface,
      });
    }, classifyGuestOfficeError);

  const submit = async () => {
    const file = state.file;
    if (!file) return;
    const source = guestOfficeFile(file);
    setOffice(source !== null);
    setTruncated(false);
    if (source) {
      await submitOffice(source, file);
      return;
    }
    await start(
      (token, locale) => createGuestDraft({ file, token, locale, entry: entry() }),
      classifyGuestDraftError,
    );
  };

  return {
    state,
    office,
    truncated,
    choose,
    submit,
    remove: () => {
      setTruncated(false);
      dispatch({ type: 'removed' });
    },
    cancel,
    playNow,
  };
}
