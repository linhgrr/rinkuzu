/**
 * True while `next build` prerenders pages. The image build has no database
 * (RIN-1704), so a loader that reads Mongo returns its empty value here instead
 * of waiting out a connection timeout.
 */
export function isProductionBuildPhase(): boolean {
  return process.env['NEXT_PHASE'] === 'phase-production-build';
}
