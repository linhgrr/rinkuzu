/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import enCreate from '../../../../../messages/en/create.json';
import viCreate from '../../../../../messages/vi/create.json';
import { PersonalDataNotice } from './PersonalDataNotice';

type Locale = 'en' | 'vi';
const messages = { en: { create: enCreate }, vi: { create: viCreate } } as const;

function renderNotice(locale: Locale, kinds: string[]) {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages[locale]}>
      <PersonalDataNotice kinds={kinds} />
    </NextIntlClientProvider>,
  );
}

// RIN-1342 (spec RIN-1336 Part 3, AC3): the owner of a flagged quiz learns why it
// stays off Google and what to remove. Kinds only, never the matched values.
describe('PersonalDataNotice', () => {
  it('English: names every detected kind, in a fixed order', () => {
    const { container } = renderNotice('en', ['id_number', 'email', 'phone']);

    expect(container).toHaveTextContent(
      "This quiz may contain personal data (phone / email / ID numbers), so it won't appear on Google. Remove it so people can find the quiz.",
    );
    expect(container).not.toHaveTextContent('thông tin');
  });

  it('Vietnamese: own copy, naming only the detected kinds', () => {
    const { container } = renderNotice('vi', ['email']);

    expect(container).toHaveTextContent(
      'Quiz này có thể chứa thông tin cá nhân (email) nên sẽ không hiển thị trên Google. Hãy xóa thông tin đó để quiz được tìm thấy.',
    );
    expect(container).not.toHaveTextContent('số điện thoại');
    expect(container).not.toHaveTextContent('personal data');
  });

  it('names a labelled student name and skips unknown kinds', () => {
    const { container } = renderNotice('en', ['labelled_name', 'future_kind']);

    expect(container).toHaveTextContent('personal data (names)');
    expect(container).not.toHaveTextContent('future_kind');
  });

  it('is secondary help text, not an alert or dialog', () => {
    const { container } = renderNotice('en', ['phone']);

    expect(container.querySelector('[role="alert"], [role="dialog"]')).toBeNull();
    expect(container.firstElementChild?.tagName).toBe('P');
  });
});
