/** Run asynchronous work in sequential, bounded-concurrency batches. */
export async function runInBatches<T, R>(
  items: readonly T[],
  batchSize: number,
  worker: (item: T) => Promise<R>,
): Promise<Array<PromiseSettledResult<R>>> {
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new Error('batchSize must be a positive integer')
  }

  const results: Array<PromiseSettledResult<R>> = []
  for (let index = 0; index < items.length; index += batchSize) {
    const batch = items.slice(index, index + batchSize)
    results.push(...(await Promise.allSettled(batch.map(worker))))
  }
  return results
}
