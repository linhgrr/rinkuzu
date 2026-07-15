export async function withCleanProbeRows(collections, marker, runProbe) {
  const cleanup = () => Promise.all(collections.map((collection) => collection.deleteMany(marker)));

  await cleanup();

  let probeError;
  try {
    return await runProbe();
  } catch (error) {
    probeError = error;
    throw error;
  } finally {
    try {
      await cleanup();
    } catch (cleanupError) {
      if (probeError) {
        throw new AggregateError(
          [probeError, cleanupError],
          'Query-plan probe and marker cleanup both failed',
        );
      }
      throw cleanupError;
    }
  }
}
