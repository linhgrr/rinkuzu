/**
 * The authored half of a quiz question: what the reader sees, minus the answer
 * key and minus whichever identity the caller's side of the boundary uses.
 */
export interface QuestionContentFields {
  readonly question: string;
  readonly options: string[];
  readonly questionImage?: string;
  readonly optionImages?: (string | undefined)[];
}

/**
 * Copies the authored fields across a persistence boundary, in either direction.
 *
 * The conditional spreads are the point. `exactOptionalPropertyTypes` is on, so
 * writing `questionImage: question.questionImage` would type-check on the way in
 * and put an explicit `undefined` into the document on the way out — a stored
 * key whose value is nothing, which reads back differently from an absent one.
 * Restating that per mapper is how one direction eventually drops it.
 */
export function questionContentFields(question: QuestionContentFields): QuestionContentFields {
  return {
    question: question.question,
    options: question.options,
    ...(question.questionImage === undefined ? {} : { questionImage: question.questionImage }),
    ...(question.optionImages === undefined ? {} : { optionImages: question.optionImages }),
  };
}
