/**
 * Una línea JSON por evento. `club_id` va siempre: null si el request no trae
 * un UUID de club. El valor es el `organization_id` del tenant; el nombre del
 * campo es el de la observabilidad del TPI.
 *
 * Solo se serializan los campos de abajo. Un email, un nombre, un DNI, un
 * token o un header de más no entra aunque alguien lo pase en el objeto.
 */

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const BEARER = /Bearer\s+\S+/gi;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type LogLevel = 'info' | 'warn' | 'error';

export type LogEvent = {
  level: LogLevel;
  msg: string;
  request_id?: string | null;
  club_id?: string | null;
  method?: string;
  path?: string;
  status?: number;
  duration_ms?: number;
};

export function clubIdFromHeader(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return UUID_PATTERN.test(trimmed) ? trimmed : null;
}

export function formatLogLine(event: LogEvent, now = new Date()): string {
  const line: Record<string, string | number | null> = {
    time: now.toISOString(),
    level: event.level,
    msg: redact(event.msg),
    request_id: event.request_id ?? null,
    club_id: event.club_id ?? null,
  };

  if (event.method !== undefined) {
    line.method = event.method;
  }
  if (event.path !== undefined) {
    line.path = pathWithoutQuery(event.path);
  }
  if (event.status !== undefined) {
    line.status = event.status;
  }
  if (event.duration_ms !== undefined) {
    line.duration_ms = event.duration_ms;
  }

  return JSON.stringify(line);
}

export function log(event: LogEvent): void {
  process.stdout.write(`${formatLogLine(event)}\n`);
}

function pathWithoutQuery(path: string): string {
  const query = path.indexOf('?');
  return query === -1 ? path : path.slice(0, query);
}

function redact(msg: string): string {
  return msg.replace(EMAIL, '[redactado]').replace(BEARER, 'Bearer [redactado]');
}
