'use client';

import { useEffect, useId, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import Image from 'next/image';
import { useFormatter, useTranslations } from 'next-intl';
import {
  HiOutlineArrowDown,
  HiOutlineArrowUp,
  HiOutlineCamera,
  HiOutlineExclamation,
  HiOutlineLockClosed,
  HiOutlinePhotograph,
  HiOutlineX,
} from 'react-icons/hi';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { type QuizPhoto, type QuizPhotosState } from '@/features/quiz-images/hooks/useQuizPhotos';
import {
  QUIZ_IMAGE_MAX_COUNT,
  QUIZ_IMAGE_MAX_INPUT_BYTES,
} from '@/features/quiz-images/lib/prepare-quiz-image';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

/** What the gallery picker offers; the camera input takes any image (UI spec RIN-1791). */
const QUIZ_PHOTO_GALLERY_ACCEPT =
  'image/jpeg,image/png,image/heic,image/heif,image/webp,.heic,.heif';

const MB = 1024 * 1024;
const LIMIT_COPY = { max: QUIZ_IMAGE_MAX_COUNT, mb: QUIZ_IMAGE_MAX_INPUT_BYTES / MB } as const;
const TOUCH_QUERY = '(pointer: coarse)';
const ROW_ICON_BUTTON = 'min-h-11 min-w-11 px-0';

type Translate = ReturnType<typeof useTranslations<'quizPhotos'>>;

interface PickerActions {
  openCamera: () => void;
  openGallery: () => void;
  touch: boolean;
  disabled: boolean;
}

/** The focus hook for a control: the picker moves focus to it after the list changed. */
const focusKey = (id: string, action: string) => `${id}:${action}`;

function EmptyZone({
  actions,
  onDrop,
}: {
  actions: PickerActions;
  onDrop: (files: File[]) => void;
}) {
  const t = useTranslations('quizPhotos');
  const [dragging, setDragging] = useState(false);
  const { touch, disabled } = actions;
  return (
    <div
      role="group"
      aria-label={t('zoneLabel')}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        onDrop(Array.from(event.dataTransfer.files));
      }}
      className={cn(
        'rounded-2xl border-2 border-dashed bg-white p-6 text-center transition-[background-color,border-color] duration-300 sm:p-8',
        dragging ? 'border-brand-action/60 bg-orange-50/50' : 'border-neutral-300',
      )}
    >
      <div className="space-y-4">
        <div
          className={cn(
            'inline-flex items-center justify-center rounded-2xl p-4 transition-colors duration-300',
            dragging ? 'bg-orange-500/10' : 'bg-neutral-100',
          )}
        >
          <HiOutlineCamera
            className={cn('size-8', dragging ? 'text-brand-trust' : 'text-neutral-400')}
            aria-hidden="true"
          />
        </div>
        {dragging ? (
          <p className="text-lg font-semibold text-brand-trust">{t('dropHere')}</p>
        ) : touch ? (
          <div className="flex flex-col gap-2">
            <Button
              size="lg"
              disabled={disabled}
              data-photo-focus="add"
              onClick={actions.openCamera}
              className="h-14 w-full"
            >
              <HiOutlineCamera className="mr-2 size-5" aria-hidden="true" />
              {t('takePhoto')}
            </Button>
            <Button
              variant="outline"
              disabled={disabled}
              onClick={actions.openGallery}
              className="h-12 w-full"
            >
              <HiOutlinePhotograph className="mr-2 size-5" aria-hidden="true" />
              {t('chooseFromGallery')}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Button
              size="lg"
              disabled={disabled}
              data-photo-focus="add"
              onClick={actions.openGallery}
              className="h-14 w-full sm:min-w-64 sm:w-auto"
            >
              <HiOutlinePhotograph className="mr-2 size-5" aria-hidden="true" />
              {t('choosePhotos')}
            </Button>
            <p className="text-sm text-neutral-600">{t('dragHint')}</p>
          </div>
        )}
        <p className="text-sm text-neutral-500">{t('limitHint', LIMIT_COPY)}</p>
      </div>
    </div>
  );
}

function Thumbnail({ photo }: { photo: QuizPhoto }) {
  const t = useTranslations('quizPhotos');
  if (photo.status === 'ready') {
    return (
      <Image
        src={photo.thumbnailUrl}
        alt=""
        width={56}
        height={56}
        unoptimized
        className="size-14 flex-shrink-0 rounded-lg object-cover"
      />
    );
  }
  return (
    <div
      className={cn(
        'flex size-14 flex-shrink-0 items-center justify-center rounded-lg',
        photo.status === 'error' ? 'bg-red-100 text-red-600' : 'bg-neutral-100',
      )}
    >
      {photo.status === 'error' ? (
        <HiOutlineExclamation className="size-6" aria-hidden="true" />
      ) : (
        <Spinner size="md" label={t('preparing')} />
      )}
    </div>
  );
}

interface PhotoRowProps {
  photo: QuizPhoto;
  page: number;
  first: boolean;
  last: boolean;
  disabled: boolean;
  t: Translate;
  state: QuizPhotosState;
}

function ErrorRow({ photo, disabled, t, state }: PhotoRowProps & { photo: QuizPhoto }) {
  if (photo.status !== 'error') return null;
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-3">
      <Thumbnail photo={photo} />
      <p
        role="alert"
        tabIndex={-1}
        data-photo-focus={focusKey(photo.id, 'label')}
        className="min-w-20 flex-1 text-sm text-red-700 outline-none"
      >
        {t(`errors.${photo.reason}`, { ...LIMIT_COPY, free: 0, added: 0 })}
      </p>
      <Button
        variant="outline"
        disabled={disabled}
        aria-label={t('removeFailed')}
        data-photo-focus={focusKey(photo.id, 'remove')}
        onClick={() => state.remove(photo.id)}
        className={cn(ROW_ICON_BUTTON, 'ml-auto text-red-600 hover:text-red-700')}
      >
        <HiOutlineX className="size-4" aria-hidden="true" />
      </Button>
    </li>
  );
}

function PhotoRow(props: PhotoRowProps) {
  const { photo, page, first, last, disabled, t, state } = props;
  const format = useFormatter();
  if (photo.status === 'error') return <ErrorRow {...props} />;
  const preparing = photo.status === 'preparing';
  const size = photo.status === 'ready' ? photo.bytes / MB : 0;
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-xl border border-neutral-200 bg-white p-3">
      <Thumbnail photo={photo} />
      <div className="min-w-20 flex-1">
        <p
          tabIndex={-1}
          data-photo-focus={focusKey(photo.id, 'label')}
          className="text-sm font-semibold text-neutral-900 outline-none"
        >
          {t('pageLabel', { page })}
        </p>
        <p className="text-xs text-neutral-500">
          {preparing
            ? t('preparing')
            : t('size', { size: format.number(size, { maximumFractionDigits: 1 }) })}
        </p>
      </div>
      <div className="ml-auto flex gap-2">
        <Button
          variant="outline"
          disabled={disabled || preparing || first}
          aria-label={t('moveUp', { page })}
          data-photo-focus={focusKey(photo.id, 'up')}
          onClick={() => state.move(photo.id, -1)}
          className={ROW_ICON_BUTTON}
        >
          <HiOutlineArrowUp className="size-4" aria-hidden="true" />
        </Button>
        <Button
          variant="outline"
          disabled={disabled || preparing || last}
          aria-label={t('moveDown', { page })}
          data-photo-focus={focusKey(photo.id, 'down')}
          onClick={() => state.move(photo.id, 1)}
          className={ROW_ICON_BUTTON}
        >
          <HiOutlineArrowDown className="size-4" aria-hidden="true" />
        </Button>
        <Button
          variant="outline"
          disabled={disabled}
          aria-label={t('remove', { page })}
          data-photo-focus={focusKey(photo.id, 'remove')}
          onClick={() => state.remove(photo.id)}
          className={cn(ROW_ICON_BUTTON, 'text-red-600 hover:text-red-700')}
        >
          <HiOutlineX className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </li>
  );
}

const ADD_BUTTON = 'min-h-12 border-dashed text-brand-trust';

function AddAnother({ state, actions }: { state: QuizPhotosState; actions: PickerActions }) {
  const t = useTranslations('quizPhotos');
  if (state.full) return null;
  const count = state.photos.filter((photo) => photo.status !== 'error').length;
  if (actions.touch) {
    return (
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          disabled={actions.disabled}
          data-photo-focus="add"
          onClick={actions.openCamera}
          className={ADD_BUTTON}
        >
          {t('takeAnother')}
        </Button>
        <Button
          variant="outline"
          disabled={actions.disabled}
          onClick={actions.openGallery}
          className={ADD_BUTTON}
        >
          {t('gallery')}
        </Button>
      </div>
    );
  }
  return (
    <Button
      variant="outline"
      disabled={actions.disabled}
      data-photo-focus="add"
      onClick={actions.openGallery}
      className={cn(ADD_BUTTON, 'w-full')}
    >
      {t('addAnother', { count, max: QUIZ_IMAGE_MAX_COUNT })}
    </Button>
  );
}

function Announcement({ state }: { state: QuizPhotosState }) {
  const t = useTranslations('quizPhotos');
  const { announcement } = state;
  const message =
    announcement?.kind === 'moved'
      ? t('announceMoved', { page: announcement.page, position: announcement.position })
      : announcement?.kind === 'removed'
        ? t('announceRemoved')
        : '';
  return (
    <p role="status" aria-live="polite" className="sr-only">
      {message}
    </p>
  );
}

function PhotoList({ state, actions }: { state: QuizPhotosState; actions: PickerActions }) {
  const t = useTranslations('quizPhotos');
  const format = useFormatter();
  const { photos, overflow } = state;
  const counted = photos.filter((photo) => photo.status !== 'error');
  const size = format.number(state.totalBytes / MB, { maximumFractionDigits: 1 });
  return (
    <div className="flex flex-col gap-2">
      {overflow ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
        >
          <HiOutlineExclamation className="mt-0.5 size-5 flex-shrink-0" aria-hidden="true" />
          <span className="min-w-0">{t('errors.too_many', { ...LIMIT_COPY, ...overflow })}</span>
        </div>
      ) : null}
      <p className="text-sm text-neutral-600">
        {t('counter', { count: counted.length, max: QUIZ_IMAGE_MAX_COUNT, size })}
      </p>
      <ul aria-label={t('listLabel')} className="flex flex-col gap-2">
        {photos.map((photo) => {
          const index = counted.findIndex((item) => item.id === photo.id);
          return (
            <PhotoRow
              key={photo.id}
              photo={photo}
              page={index + 1}
              first={index === 0}
              last={index === counted.length - 1}
              disabled={actions.disabled}
              t={t}
              state={state}
            />
          );
        })}
      </ul>
      <AddAnother state={state} actions={actions} />
    </div>
  );
}

interface QuizPhotoSubmit {
  label: string;
  loading: boolean;
  onClick: () => void;
}

interface QuizPhotoPickerProps {
  /** The photo list, from `useQuizPhotos`. */
  photos: QuizPhotosState;
  /** Set-level errors (`too_little_text`, a failed send), shown above the photos. */
  alert?: ReactNode;
  submit: QuizPhotoSubmit;
  disabled?: boolean;
}

/**
 * The photo picker of the guest and signed-in photo pages (UI spec RIN-1791, RIN-1793): an
 * empty zone with a camera and a gallery button (one button and drag and drop with a fine
 * pointer), then one row per photo with page number, thumbnail, move up, move down and
 * remove (all 44 px), "add another" up to 5 and the submit button. The photos are prepared
 * in the browser by `useQuizPhotos`; nothing is sent until the page's `submit` runs.
 */
export function QuizPhotoPicker({
  photos: state,
  alert,
  submit,
  disabled = false,
}: QuizPhotoPickerProps) {
  const t = useTranslations('quizPhotos');
  const touch = useMediaQuery(TOUCH_QUERY);
  const rootRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const hintId = useId();
  const { focus, clearFocus, add } = state;
  const actions: PickerActions = {
    openCamera: () => cameraRef.current?.click(),
    openGallery: () => galleryRef.current?.click(),
    touch,
    disabled,
  };

  useEffect(() => {
    if (!focus) return;
    const root = rootRef.current;
    const keys =
      focus === 'add'
        ? ['add']
        : focus.action === 'up'
          ? [focusKey(focus.id, 'up'), focusKey(focus.id, 'down')]
          : focus.action === 'down'
            ? [focusKey(focus.id, 'down'), focusKey(focus.id, 'up')]
            : [focusKey(focus.id, focus.action)];
    for (const key of keys) {
      const node = root?.querySelector<HTMLElement>(`[data-photo-focus="${key}"]`);
      if (node && !(node instanceof HTMLButtonElement && node.disabled)) {
        node.focus();
        break;
      }
    }
    clearFocus();
  }, [focus, clearFocus]);

  const onPick = (event: ChangeEvent<HTMLInputElement>) => {
    add(Array.from(event.target.files ?? []));
    // The same photo can be picked again after it was removed.
    event.target.value = '';
  };

  const empty = state.photos.length === 0;
  return (
    <div ref={rootRef} className="space-y-6">
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        data-photo-input="camera"
        onChange={onPick}
      />
      <input
        ref={galleryRef}
        type="file"
        accept={QUIZ_PHOTO_GALLERY_ACCEPT}
        multiple
        hidden
        data-photo-input="gallery"
        onChange={onPick}
      />
      <Announcement state={state} />
      {alert}
      {empty ? (
        <EmptyZone actions={actions} onDrop={add} />
      ) : (
        <>
          <PhotoList state={state} actions={actions} />
          <div className="space-y-2">
            <Button
              size="lg"
              loading={submit.loading}
              disabled={!state.canSubmit || disabled}
              aria-describedby={state.failed > 0 ? hintId : undefined}
              onClick={submit.onClick}
              className="h-14 w-full sm:w-auto sm:min-w-64"
            >
              {submit.label}
            </Button>
            {state.failed > 0 ? (
              <p id={hintId} className="text-sm text-neutral-600">
                {t('blockedByFailed')}
              </p>
            ) : null}
          </div>
        </>
      )}
      <div className="space-y-2 text-xs leading-5 text-neutral-500">
        <p>{t('handwriting')}</p>
        <p className="flex items-start gap-1.5">
          <HiOutlineLockClosed className="mt-0.5 size-3.5 flex-shrink-0" aria-hidden="true" />
          <span>{t('privacy')}</span>
        </p>
      </div>
    </div>
  );
}
