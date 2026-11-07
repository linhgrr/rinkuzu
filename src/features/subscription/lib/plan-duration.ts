/** The `pricing` translator, narrowed to the one message this formatter reads. */
type PlanDurationTranslator = (key: 'planDuration', values: { months: number }) => string;

/**
 * Localised plan length ("1 tháng", "6 months"). The plan catalogue's
 * `displayName` is English-only, so pages never render it (RIN-1015).
 */
export function formatPlanDuration(t: PlanDurationTranslator, months: number): string {
  return t('planDuration', { months });
}
