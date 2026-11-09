'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { HiOutlineCollection } from 'react-icons/hi';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import type {
  AdminQuizTopicsController,
  QuizTopicEditor,
  TopicAssignTarget,
} from '@/features/admin/quizzes/hooks/useAdminQuizTopics';
import {
  QUIZ_TOPIC_INTRO_MAX_WORDS,
  QUIZ_TOPIC_INTRO_MIN_WORDS,
  QUIZ_TOPIC_SLUG_PATTERN,
  countIntroWords,
} from '@/shared/constants/quiz-topic';

interface ControllerProps {
  controller: AdminQuizTopicsController;
}

interface TopicFormProps extends ControllerProps {
  editor: QuizTopicEditor;
}

function TopicForm({ editor, controller }: TopicFormProps) {
  const t = useTranslations('admin.quizTopics');
  const initial = editor.mode === 'edit' ? editor.topic : null;
  const [name, setName] = useState(initial?.name ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [intro, setIntro] = useState(initial?.intro ?? '');
  const pending = controller.pendingId === 'editor';
  const words = countIntroWords(intro);
  const slugValid = QUIZ_TOPIC_SLUG_PATTERN.test(slug);

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void controller.save({ name: name.trim(), slug, intro });
      }}
    >
      <Input
        label={t('nameField')}
        value={name}
        required
        minLength={2}
        maxLength={120}
        onChange={(event) => setName(event.target.value)}
      />
      <Input
        label={t('slugField')}
        value={slug}
        required
        minLength={2}
        maxLength={80}
        hint={t('slugHint', { slug: slug || 'kinh-te-vi-mo' })}
        error={slug && !slugValid ? t('slugInvalid') : undefined}
        onChange={(event) => setSlug(event.target.value.toLowerCase())}
      />
      <label className="block text-sm font-semibold text-ink">
        {t('introField')}
        <textarea
          className="input mt-1.5 min-h-40 w-full font-normal"
          value={intro}
          maxLength={6000}
          aria-describedby="quiz-topic-intro-words"
          onChange={(event) => setIntro(event.target.value)}
        />
      </label>
      <p id="quiz-topic-intro-words" className="text-sm text-ink/60">
        {t('introWords', {
          count: words,
          min: QUIZ_TOPIC_INTRO_MIN_WORDS,
          max: QUIZ_TOPIC_INTRO_MAX_WORDS,
        })}
      </p>
      {controller.editorError ? (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {controller.editorError}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => controller.openEditor(null)}
        >
          {t('cancel')}
        </Button>
        <Button type="submit" loading={pending} disabled={!slugValid}>
          {t(editor.mode === 'create' ? 'createConfirm' : 'saveConfirm')}
        </Button>
      </div>
    </form>
  );
}

/** Name, slug and intro of a topic; new topics start as drafts. */
export function QuizTopicEditorDialog({ controller }: ControllerProps) {
  const t = useTranslations('admin.quizTopics');
  const editor = controller.editor;

  return (
    <Modal
      isOpen={editor !== null}
      title={t(editor?.mode === 'edit' ? 'editTitle' : 'createTitle')}
      size="large"
      onClose={() => {
        if (controller.pendingId !== 'editor') controller.openEditor(null);
      }}
    >
      {editor ? (
        <TopicForm
          key={editor.mode === 'edit' ? editor.topic.id : 'create'}
          editor={editor}
          controller={controller}
        />
      ) : null}
    </Modal>
  );
}

interface AssignTopicButtonProps extends ControllerProps {
  quiz: { id: string; title: string; visibility: 'public' | 'personal' };
}

/** The quiz row action; only public quizzes can join a topic. */
export function AssignTopicButton({ quiz, controller }: AssignTopicButtonProps) {
  const t = useTranslations('admin.quizTopics');
  const hint = quiz.visibility === 'public' ? undefined : t('assignBlockedNotPublic');

  return (
    <span title={hint} className="inline-flex">
      <Button
        size="sm"
        variant="outline"
        disabled={hint !== undefined || controller.items.length === 0}
        aria-describedby={hint ? `assign-topic-hint-${quiz.id}` : undefined}
        onClick={() => controller.openAssign({ quizId: quiz.id, title: quiz.title })}
      >
        <HiOutlineCollection className="mr-1 size-4" aria-hidden="true" />
        {t('assignAction')}
      </Button>
      {hint ? (
        <span id={`assign-topic-hint-${quiz.id}`} className="sr-only">
          {hint}
        </span>
      ) : null}
    </span>
  );
}

interface AssignFormProps extends ControllerProps {
  target: TopicAssignTarget;
}

function AssignForm({ target, controller }: AssignFormProps) {
  const t = useTranslations('admin.quizTopics');
  const [topicId, setTopicId] = useState(controller.openTopicId ?? controller.items[0]?.id ?? '');
  const [position, setPosition] = useState(0);
  const pending = controller.pendingId === 'assign';
  const quizCount = controller.items.find((topic) => topic.id === topicId)?.quizCount ?? 0;

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void controller.assign(topicId, position || undefined);
      }}
    >
      <p className="text-sm text-ink/70">{t('assignDescription', { title: target.title })}</p>
      <Select
        label={t('topicField')}
        value={topicId}
        onChange={(event) => {
          setTopicId(event.target.value);
          setPosition(0);
        }}
      >
        {controller.items.map((topic) => (
          <option key={topic.id} value={topic.id}>
            {topic.name}
          </option>
        ))}
      </Select>
      <Select
        label={t('positionField')}
        value={String(position)}
        onChange={(event) => setPosition(Number(event.target.value))}
      >
        <option value="0">{t('positionLast', { position: quizCount + 1 })}</option>
        {Array.from({ length: quizCount }, (_, index) => index + 1).map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </Select>
      {controller.assignError ? (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {controller.assignError}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => controller.openAssign(null)}
        >
          {t('cancel')}
        </Button>
        <Button type="submit" loading={pending} disabled={!topicId}>
          {t('assignConfirm')}
        </Button>
      </div>
    </form>
  );
}

/** Topic (preset to the open one) and position (default last) for a quiz joining a topic. */
export function AssignTopicDialog({ controller }: ControllerProps) {
  const t = useTranslations('admin.quizTopics');
  const target = controller.assignTarget;

  return (
    <Modal
      isOpen={target !== null}
      title={t('assignTitle')}
      onClose={() => {
        if (controller.pendingId !== 'assign') controller.openAssign(null);
      }}
    >
      {target ? <AssignForm key={target.quizId} target={target} controller={controller} /> : null}
    </Modal>
  );
}
