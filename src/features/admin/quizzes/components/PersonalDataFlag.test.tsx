/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import enAdmin from '../../../../../messages/en/admin.json';
import viAdmin from '../../../../../messages/vi/admin.json';
import { PersonalDataFlagBadge } from './PersonalDataFlag';

const messages = { en: { admin: enAdmin }, vi: { admin: viAdmin } } as const;

function renderBadge(locale: 'en' | 'vi', kinds: string[]) {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages[locale]}>
      <PersonalDataFlagBadge kinds={kinds} />
    </NextIntlClientProvider>,
  );
}

// RIN-1342 (spec RIN-1336 Part 3, AC4): the admin badge lists the detected kinds.
describe('PersonalDataFlagBadge', () => {
  it('lists the kinds in English, in display order', () => {
    const { container } = renderBadge('en', ['email', 'id_number', 'phone']);
    expect(container).toHaveTextContent('Personal data: phone, email, ID number');
  });

  it('uses the Vietnamese copy and drops unknown kinds', () => {
    const { container } = renderBadge('vi', ['labelled_name', 'future_kind']);
    expect(container).toHaveTextContent('Thông tin cá nhân: họ tên');
    expect(container).not.toHaveTextContent('future_kind');
  });
});
