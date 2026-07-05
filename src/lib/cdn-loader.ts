/**
 * CDN dynamic-import helper with timeout + parallelisation.
 *
 * Why: TalkingHead and HeadAudio are loaded from jsdelivr at runtime
 * because their bundled `import()` calls can't be resolved by Webpack/Turbopack.
 * If jsdelivr is slow or blocked, the whole avatar UI hangs forever — this
 * helper races the import against a deadline and surfaces a typed error.
 */

export class CdnLoadTimeout extends Error {
  constructor(url: string, ms: number) {
    super(`CDN load timed out after ${ms}ms: ${url}`);
    this.name = "CdnLoadTimeout";
  }
}

export interface CdnImportOptions {
  /** Timeout in ms. Defaults to 8000. */
  timeoutMs?: number;
  /** AbortSignal that, when aborted, rejects the import. */
  signal?: AbortSignal;
}

/**
 * Race a dynamic import against a deadline.
 * Throws `CdnLoadTimeout` if the import doesn't resolve in time.
 */
export async function importWithTimeout<T = unknown>(
  url: string,
  options: CdnImportOptions = {},
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? 8000;

  const importPromise = import(/* webpackIgnore: true */ /* @vite-ignore */ url) as Promise<T>;

  const timeoutPromise = new Promise<never>((_, reject) => {
    const timer = setTimeout(() => reject(new CdnLoadTimeout(url, timeoutMs)), timeoutMs);
    options.signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });

  return Promise.race([importPromise, timeoutPromise]);
}

/**
 * Convenience: run multiple async tasks in parallel with a single shared timeout.
 * If any task fails, the whole batch rejects.
 */
export async function parallelWithTimeout<T extends readonly unknown[]>(
  tasks: { [K in keyof T]: Promise<T[K]> },
  timeoutMs = 12000,
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`Parallel batch timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  return Promise.race([Promise.all(tasks) as Promise<T>, timeoutPromise]);
}
