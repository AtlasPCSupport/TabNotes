let fallbackQueue: Promise<unknown> = Promise.resolve();

/** Shared by extension pages and the MV3 worker (same extension origin). */
export async function withStorageLock<T>(operation: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.locks) {
    return await navigator.locks.request('tabnotes-data-write', operation);
  }
  // Non-browser adapters/tests have no LockManager. Chrome MV3 supports Web Locks.
  const result = fallbackQueue.then(operation, operation);
  fallbackQueue = result.catch(() => undefined);
  return result;
}
