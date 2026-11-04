import * as Sentry from '@sentry/react';
import type { DataCollection, ErrorEvent } from '@sentry/core';
import { readSentryDsn } from './dsn';
import { scrubSentryEvent } from './scrub';

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

export function initSentry(): boolean {
  const dsn = readSentryDsn(import.meta.env.VITE_SENTRY_DSN);
  if (!dsn) {
    return false;
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    maxBreadcrumbs: 0,
    dataCollection: DATA_COLLECTION,
    beforeSend(event: ErrorEvent) {
      return scrubSentryEvent(event);
    },
  });
  return true;
}

export { ErrorBoundary } from '@sentry/react';
