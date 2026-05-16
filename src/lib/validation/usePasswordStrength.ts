'use client';

import { useEffect, useState } from 'react';

import type { PasswordStrength } from '@/lib/validation/auth';
import { scorePassword } from '@/lib/validation/auth';

let zxcvbnLoader: Promise<(p: string) => { score: number }> | null = null;

async function loadZxcvbn(): Promise<(p: string) => { score: number }> {
  if (zxcvbnLoader) return zxcvbnLoader;

  zxcvbnLoader = Promise.all([
    import('@zxcvbn-ts/core'),
    import('@zxcvbn-ts/language-common'),
    import('@zxcvbn-ts/language-en'),
  ]).then(([core, common, en]) => {
    core.zxcvbnOptions.setOptions({
      translations: en.translations,
      graphs: common.adjacencyGraphs,
      dictionary: {
        ...common.dictionary,
        ...en.dictionary,
      },
    });
    return (password: string) => core.zxcvbn(password);
  });

  return zxcvbnLoader;
}

/**
 * Score a password 0..4 using zxcvbn-ts. Returns the heuristic fallback score
 * synchronously while the dictionary loads, then upgrades to the real score
 * once the bundle is ready.
 */
export function usePasswordStrength(password: string): PasswordStrength {
  const [score, setScore] = useState<PasswordStrength>(() => scorePassword(password));

  useEffect(() => {
    const fallbackScore = scorePassword(password);
    setScore(fallbackScore);

    if (!password) {
      return;
    }

    let cancelled = false;
    loadZxcvbn().then((zxcvbn) => {
      if (cancelled) return;
      const result = zxcvbn(password);
      const clamped = Math.max(0, Math.min(4, result.score)) as PasswordStrength;
      setScore(clamped);
    });
    return () => {
      cancelled = true;
    };
  }, [password]);

  return score;
}
