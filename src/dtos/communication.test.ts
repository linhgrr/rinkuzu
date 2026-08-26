import { describe, expect, it } from 'vitest';
import {
  createCampaignSchema,
  createFeedbackConversationSchema,
  createSupportAttachmentSchema,
  marketingPreferenceSchema,
  scheduleCampaignSchema,
} from './communication';

describe('communication request contracts', () => {
  it('accepts the safe campaign block vocabulary and rejects unsafe URLs', () => {
    const base = {
      name: 'Product update August',
      subject: 'A useful update',
      topic: 'product_updates',
    };
    expect(
      createCampaignSchema.safeParse({
        ...base,
        blocks: [
          { id: '00000000-0000-4000-8000-000000000001', type: 'heading', text: 'New', level: 2 },
          { id: '00000000-0000-4000-8000-000000000002', type: 'paragraph', text: 'Details' },
          {
            id: '00000000-0000-4000-8000-000000000003',
            type: 'button',
            label: 'Open',
            url: 'https://rinkuzu.app',
          },
        ],
      }).success,
    ).toBe(true);
    expect(
      createCampaignSchema.safeParse({
        ...base,
        blocks: [
          {
            id: '00000000-0000-4000-8000-000000000004',
            type: 'button',
            label: 'Open',
            url: 'javascript:alert(1)',
          },
        ],
      }).success,
    ).toBe(false);
  });

  it('requires one-user feedback outreach with bounded content', () => {
    expect(
      createFeedbackConversationSchema.safeParse({
        userId: '507f1f77bcf86cd799439011',
        subject: 'How is RinKuzu?',
        body: 'Your voluntary feedback helps us improve.',
        clientMessageId: 'request-12345678',
      }).success,
    ).toBe(true);
    expect(
      createFeedbackConversationSchema.safeParse({
        userIds: ['507f1f77bcf86cd799439011'],
        subject: 'Bulk',
        body: 'Not allowed',
        clientMessageId: 'request-12345678',
      }).success,
    ).toBe(false);
  });

  it('enforces support screenshot type and size', () => {
    expect(
      createSupportAttachmentSchema.safeParse({
        fileName: 'screen.webp',
        contentType: 'image/webp',
        fileSize: 5 * 1024 * 1024,
      }).success,
    ).toBe(true);
    expect(
      createSupportAttachmentSchema.safeParse({
        fileName: 'payload.svg',
        contentType: 'image/svg+xml',
        fileSize: 100,
      }).success,
    ).toBe(false);
  });

  it('keeps marketing topics independent and requires an explicit schedule confirmation', () => {
    expect(
      marketingPreferenceSchema.parse({ productUpdates: true, promotions: false }),
    ).toMatchObject({ productUpdates: true, promotions: false });
    expect(
      scheduleCampaignSchema.safeParse({
        revision: 3,
        scheduledAt: '2026-08-26T10:00:00.000Z',
        confirmation: 'GỬI 42',
      }).success,
    ).toBe(true);
  });
});
