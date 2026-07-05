/**
 * Tiny logger wrapper.
 *
 * - In development: forwards to `console`.
 * - In production: silent for `debug`/`info`/`warn`; preserves `error`
 *   so genuine failures still surface in browser dev tools and server logs.
 *
 * Replace this with Pino / Sentry / etc when the time comes — the surface area
 * stays identical so call sites don't change.
 */

type LogArgs = readonly unknown[];

const isDev =
  typeof process !== "undefined"
    ? process.env.NODE_ENV !== "production"
    : true;

function format(scope: string | undefined, args: LogArgs): LogArgs {
  if (!scope) return args;
  return [`[${scope}]`, ...args];
}

export interface Logger {
  debug: (...args: LogArgs) => void;
  info: (...args: LogArgs) => void;
  warn: (...args: LogArgs) => void;
  error: (...args: LogArgs) => void;
  child: (scope: string) => Logger;
}

function makeLogger(scope?: string): Logger {
  return {
    debug: (...args) => {
      if (isDev) console.debug(...format(scope, args));
    },
    info: (...args) => {
      if (isDev) console.info(...format(scope, args));
    },
    warn: (...args) => {
      if (isDev) console.warn(...format(scope, args));
    },
    error: (...args) => {
      // Always surface errors — even in production, you want these in the console.
      console.error(...format(scope, args));
    },
    child: (childScope: string) => makeLogger(scope ? `${scope}/${childScope}` : childScope),
  };
}

export const logger = makeLogger();
