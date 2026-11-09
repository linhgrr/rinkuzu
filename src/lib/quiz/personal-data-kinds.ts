/** Kinds the personal-data check can record, in the order the UI names them (RIN-1342). */
const PERSONAL_DATA_KIND_DISPLAY_ORDER = ['phone', 'email', 'id_number', 'labelled_name'] as const;

export type DisplayedPersonalDataKind = (typeof PERSONAL_DATA_KIND_DISPLAY_ORDER)[number];

/**
 * The stored kinds the UI can name, in display order. Unknown kinds (a newer
 * detector than this client) are dropped rather than shown raw.
 */
export function toDisplayedPersonalDataKinds(kinds: readonly string[]): DisplayedPersonalDataKind[] {
  const present = new Set(kinds);
  return PERSONAL_DATA_KIND_DISPLAY_ORDER.filter((kind) => present.has(kind));
}
