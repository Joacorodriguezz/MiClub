/**
 * El DSN del browser es público (Vite lo incrusta), pero vacío o con
 * placeholder no inicializa el SDK. No inventamos uno.
 */
const PLACEHOLDER = /your[_-]/i;
const DSN_SHAPE = /^https:\/\/[^@\s/]+@[^/\s]+\/\d+$/;

export function readSentryDsn(value: string | undefined): string | null {
  const dsn = value?.trim() ?? '';
  if (!DSN_SHAPE.test(dsn) || PLACEHOLDER.test(dsn)) {
    return null;
  }
  return dsn;
}
