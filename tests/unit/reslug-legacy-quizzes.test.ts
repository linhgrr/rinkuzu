import { describe, expect, it } from 'vitest';

import { planLegacyReslugs, planRevertFromBackup } from '../../scripts/reslug-legacy-quizzes.mjs';

const mangled = { _id: 'q1', title: 'KTPM Chương 7 P1', slug: 'ktpm-chng-7-p1-244002' };

describe('planLegacyReslugs', () => {
  it('re-slugs a dropped-letter quiz from its title and keeps the existing suffix', () => {
    const plan = planLegacyReslugs({ candidates: [mangled], takenSlugs: [mangled.slug] });
    expect(plan).toEqual({
      renames: [{ _id: 'q1', from: 'ktpm-chng-7-p1-244002', to: 'ktpm-chuong-7-p1-244002' }],
      skipped: [],
    });
  });

  it('leaves English and already-readable Vietnamese quizzes untouched', () => {
    const plan = planLegacyReslugs({
      candidates: [
        { _id: 'en', title: "Bloom's Taxonomy: Basics", slug: 'blooms-taxonomy-basics-123456' },
        { _id: 'vi', title: 'Ôn tập tổng hợp', slug: 'on-tap-tong-hop-654321' },
      ],
      takenSlugs: [],
    });
    expect(plan).toEqual({ renames: [], skipped: [] });
  });

  it('re-slugs a quiz whose title was edited after its slug was made', () => {
    const plan = planLegacyReslugs({
      candidates: [{ _id: 'q2', title: 'Toán lớp 4', slug: 'sss' }],
      takenSlugs: [],
    });
    expect(plan).toEqual({ renames: [{ _id: 'q2', from: 'sss', to: 'toan-lop-4' }], skipped: [] });
  });

  it('skips a quiz whose new slug is already a slug or alias of another quiz', () => {
    const plan = planLegacyReslugs({
      candidates: [mangled],
      takenSlugs: ['ktpm-chuong-7-p1-244002'],
    });
    expect(plan.renames).toEqual([]);
    expect(plan.skipped).toEqual([{ _id: 'q1', slug: mangled.slug, reason: 'collision' }]);
  });

  it('lets only the first of two quizzes that compute the same slug through', () => {
    const twin = { _id: 'q3', title: 'KTPM Chương 7 P1', slug: 'ktpm-chng-7-p1-244002' };
    const plan = planLegacyReslugs({ candidates: [mangled, twin], takenSlugs: [] });
    expect(plan.renames.map((rename) => rename._id)).toEqual(['q1']);
    expect(plan.skipped).toEqual([{ _id: 'q3', slug: twin.slug, reason: 'collision' }]);
  });

  it('re-slugs a suffix-less legacy slug without adding a suffix', () => {
    const plan = planLegacyReslugs({
      candidates: [{ _id: 'q4', title: 'Nhật ngành final', slug: 'nht-ngnh-final' }],
      takenSlugs: [],
    });
    expect(plan.renames).toEqual([{ _id: 'q4', from: 'nht-ngnh-final', to: 'nhat-nganh-final' }]);
  });

  it('skips a title with nothing slug-worthy', () => {
    const plan = planLegacyReslugs({
      candidates: [{ _id: 'b', title: '情報セキュリティ', slug: '-111111' }],
      takenSlugs: [],
    });
    expect(plan.renames).toEqual([]);
    expect(plan.skipped).toEqual([{ _id: 'b', slug: '-111111', reason: 'empty-title' }]);
  });
});

describe('planRevertFromBackup', () => {
  it('restores the exact slug and aliases the backup recorded, absent aliases as null', () => {
    const steps = planRevertFromBackup({
      quizzes: [
        { _id: 'q1', slug: 'ktpm-chng-7-p1-244002', newSlug: 'ktpm-chuong-7-p1-244002' },
        {
          _id: 'q2',
          slug: 'nht-ngnh-final-100200',
          newSlug: 'nhat-nganh-final-100200',
          slugAliases: ['older-100200'],
        },
      ],
    });
    expect(steps).toEqual([
      {
        _id: 'q1',
        from: 'ktpm-chuong-7-p1-244002',
        to: 'ktpm-chng-7-p1-244002',
        slugAliases: null,
      },
      {
        _id: 'q2',
        from: 'nhat-nganh-final-100200',
        to: 'nht-ngnh-final-100200',
        slugAliases: ['older-100200'],
      },
    ]);
  });
});
