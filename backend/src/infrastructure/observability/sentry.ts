import * as Sentry from '@sentry/node';
import type { DataCollection, ErrorEvent } from '@sentry/core';

/**
 * Sentry solo arranca con un DSN https real. Vacío o con placeholder: no se
 * llama al SDK. El DSN no se loguea.
 */
const PLACEHOLDER = /your[_-]/i;
const DSN_SHAPE = /^https:\/\/[^@\s/]+@[^/\s]+\/\d+$/;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const BEARER = /Bearer\s+\S+/gi;
const POSTGRES_URL = /postgres(?:ql)?:\/\/\S+/gi;

const DATA_COLLECTION: DataCollection = {
  userInfo: false,
  cookies: false,
  httpHeaders: false,
  httpBodies: [],
  urlQueryParams: false,
  databaseQueryData: false,
  stackFrameVariables: false,
  frameContextLines: 0,
  graphQL: { document: false, variables: false },
  genAI: { inputs: false, outputs: false },
};

let enabled = false;

export type SentryContext = {
  module: string;
  clubId?: string | null;
  requestId?: string | null;
};

export function readSentryDsn(value: string | undefined): string | null {
  const dsn = value?.trim() ?? '';
  if (!DSN_SHAPE.test(dsn) || PLACEHOLDER.test(dsn)) {
    return null;
  }
  return dsn;
}

export function moduleFromPath(path: string): string {
  if (path === '/health' || path === '/ready' || path === '/') {
    return 'platform';
  }
  if (path === '/session' || path.startsWith('/session/')) {
    return 'auth';
  }
  const segment = path.split('/').filter(Boolean)[0];
  return segment ?? 'platform';
}

export function scrubSentryEvent(event: ErrorEvent): ErrorEvent {
  const next: ErrorEvent = {
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

export function initSentry(): boolean {
  const dsn = readSentryDsn(process.env.SENTRY_DSN);
  if (!dsn || enabled) {
    return enabled;
  }

  Sentry.initWithoutDefaultIntegrations({
    dsn,
    environment: process.env.NODE_ENV,
    maxBreadcrumbs: 0,
    includeLocalVariables: false,
    enableRuntimeChannelInjection: false,
    dataCollection: DATA_COLLECTION,
    integrations: [
      Sentry.onUncaughtExceptionIntegration(),
      Sentry.onUnhandledRejectionIntegration(),
      Sentry.linkedErrorsIntegration(),
      Sentry.dedupeIntegration(),
    ],
    beforeSend(event) {
      return scrubSentryEvent(event);
    },
  });
  enabled = true;
  return true;
}

export function captureError(error: unknown, context: SentryContext): void {
  if (!enabled) {
    return;
  }

  Sentry.withScope((scope) => {
    scope.setTag('module', context.module);
    scope.setFingerprint(['{{ default }}', context.module]);
    if (context.clubId) {
      scope.setTag('club_id', context.clubId);
    }
    if (context.requestId) {
      scope.setTag('request_id', context.requestId);
    }
    Sentry.captureException(error);
  });
}

function redact(value: string): string {
  return value.replace(EMAIL, '[redactado]').replace(BEARER, 'Bearer [redactado]').replace(POSTGRES_URL, '[redactado]');
}
