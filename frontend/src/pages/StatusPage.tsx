import { useCallback, useEffect, useState } from 'react';
import { getApiCheck, readApiUrl, type ApiCheck } from '../shared/api/client';

type CheckState =
  | { kind: 'loading' }
  | { kind: 'ok'; result: ApiCheck }
  | { kind: 'error'; message: string };

const initialChecks = {
  health: { kind: 'loading' } as CheckState,
  ready: { kind: 'loading' } as CheckState,
};

export function StatusPage() {
  const apiUrl = readApiUrl();
  const [health, setHealth] = useState<CheckState>(initialChecks.health);
  const [ready, setReady] = useState<CheckState>(initialChecks.ready);

  const load = useCallback(async () => {
    if (!apiUrl) {
      return;
    }
    setHealth({ kind: 'loading' });
    setReady({ kind: 'loading' });

    const [healthResult, readyResult] = await Promise.allSettled([
      getApiCheck('/health'),
      getApiCheck('/ready'),
    ]);
    setHealth(toCheckState(healthResult, '/health'));
    setReady(toCheckState(readyResult, '/ready'));
  }, [apiUrl]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="page">
      <h1>MiClub</h1>
      <p className="lead">Estado de la API. Esta pantalla no pide datos de socios.</p>

      {apiUrl ? (
        <>
          <p className="api-url">
            API: <code>{apiUrl}</code>
          </p>
          <button type="button" onClick={() => void load()} disabled={health.kind === 'loading'}>
            Consultar de nuevo
          </button>
          <section className="checks" aria-live="polite">
            <CheckCard title="/health" state={health} />
            <CheckCard title="/ready" state={ready} />
          </section>
        </>
      ) : (
        <p className="banner" role="alert">
          Falta <code>VITE_API_URL</code> o no es una URL http(s). Copiá{' '}
          <code>.env.example</code> a <code>.env.local</code> y completá la URL de la API.
        </p>
      )}
    </main>
  );
}

function toCheckState(result: PromiseSettledResult<ApiCheck>, path: string): CheckState {
  if (result.status === 'rejected') {
    return { kind: 'error', message: `No se pudo contactar ${path}` };
  }
  return { kind: 'ok', result: result.value };
}

function CheckCard({ title, state }: { title: string; state: CheckState }) {
  if (state.kind === 'loading') {
    return (
      <article className="card">
        <h2>{title}</h2>
        <p>Consultando…</p>
      </article>
    );
  }

  if (state.kind === 'error') {
    return (
      <article className="card">
        <h2>{title}</h2>
        <p className="pill bad">{state.message}</p>
      </article>
    );
  }

  const { httpStatus, body } = state.result;
  const apiStatus = readStatus(body);
  const healthy = httpStatus >= 200 && httpStatus < 300;

  return (
    <article className="card">
      <h2>{title}</h2>
      <p className={healthy ? 'pill ok' : 'pill bad'}>
        HTTP {httpStatus}
        {apiStatus ? ` · ${apiStatus}` : ''}
      </p>
      <Detail body={body} />
    </article>
  );
}

function readStatus(body: unknown): string | null {
  if (typeof body !== 'object' || body === null || !('status' in body)) {
    return null;
  }
  const status = body.status;
  return typeof status === 'string' ? status : null;
}

function Detail({ body }: { body: unknown }) {
  if (typeof body !== 'object' || body === null) {
    return <p>La respuesta no es JSON.</p>;
  }

  const uptime = 'uptime' in body && typeof body.uptime === 'number' ? body.uptime : null;
  const timestamp = 'timestamp' in body && typeof body.timestamp === 'string' ? body.timestamp : null;

  if (uptime === null && timestamp === null) {
    return null;
  }

  return (
    <dl>
      {uptime !== null ? (
        <>
          <dt>uptime</dt>
          <dd>{uptime.toFixed(1)} s</dd>
        </>
      ) : null}
      {timestamp !== null ? (
        <>
          <dt>timestamp</dt>
          <dd>{timestamp}</dd>
        </>
      ) : null}
    </dl>
  );
}
