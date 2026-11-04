const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const BEARER = /Bearer\s+\S+/gi;
const POSTGRES_URL = /postgres(?:ql)?:\/\/\S+/gi;

export type ScrubbableEvent = {
  message?: string;
  user?: unknown;
  request?: unknown;
  extra?: unknown;
  breadcrumbs?: unknown;
  server_name?: string;
  logentry?: { message?: string; params?: unknown[] };
  exception?: { values?: Array<{ value?: string }> };
};

export function scrubSentryEvent<T extends ScrubbableEvent>(event: T): T {
  const next: T = {
    ...event,
    message: typeof event.message === 'string' ? redact(event.message) : event.message,
    user: undefined,
    request: undefined,
    extra: undefined,
    breadcrumbs: undefined,
    server_name: undefined,
  };

  if (event.logentry?.message) {
    next.logentry = { message: redact(event.logentry.message) };
  }

  if (event.exception?.values) {
    next.exception = {
      values: event.exception.values.map((entry) => ({
        ...entry,
        value: typeof entry.value === 'string' ? redact(entry.value) : entry.value,
      })),
    };
  }

  return next;
}

function redact(value: string): string {
  return value.replace(EMAIL, '[redactado]').replace(BEARER, 'Bearer [redactado]').replace(POSTGRES_URL, '[redactado]');
}
