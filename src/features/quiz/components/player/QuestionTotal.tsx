'use client';

import { createContext, use } from 'react';

/**
 * True while more questions may still be appended to the round, for example the rest of a
 * guest draft that opened on its first batch (RIN-1620): every total then reads "5+".
 */
export const MoreQuestionsComingContext = createContext(false);

/**
 * The number of questions in the round, as the counters show it. Tabular figures, so "5+"
 * turning into "10" does not move the header.
 */
export function QuestionTotal({ count }: { count: number }) {
  const moreComing = use(MoreQuestionsComingContext);
  return (
    <span className="tabular-nums">
      {count}
      {moreComing ? '+' : null}
    </span>
  );
}
