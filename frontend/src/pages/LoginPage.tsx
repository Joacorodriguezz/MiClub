import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { getSession, isOrganizationId, readApiUrl } from '../shared/api/client';
import { createSupabase, readSupabaseConfig } from '../features/auth/supabase';

type SessionView =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'in'; organizationId: string; role: string }
  | { kind: 'rejected'; message: string };

export function LoginPage() {
  const apiUrl = useMemo(() => readApiUrl(), []);
  const supabaseConfig = useMemo(() => readSupabaseConfig(), []);
  const supabase = useMemo(
    () => (supabaseConfig ? createSupabase(supabaseConfig) : null),
    [supabaseConfig],
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [session, setSession] = useState<SessionView>({ kind: 'idle' });

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!supabase) {
      return;
    }
    const clubId = organizationId.trim();
    if (!isOrganizationId(clubId)) {
      setSession({ kind: 'rejected', message: 'El id del club tiene que ser un UUID.' });
      return;
    }
    setSession({ kind: 'loading' });
    setPassword('');

    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error || !data.session?.access_token) {
      setSession({
        kind: 'rejected',
        message: error ? 'No se pudo iniciar sesión.' : 'Supabase no devolvió un token.',
      });
      return;
    }

    try {
      const result = await getSession(data.session.access_token, clubId);
      const body = result.body;
      if (result.httpStatus === 200 && isSessionBody(body)) {
        setSession({ kind: 'in', organizationId: body.organizationId, role: body.role });
        return;
      }
      const message =
        typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string'
          ? body.error
          : `HTTP ${result.httpStatus}`;
      setSession({ kind: 'rejected', message });
    } catch {
      setSession({ kind: 'rejected', message: 'No se pudo contactar /session.' });
    }
  }

  async function signOut() {
    await supabase?.auth.signOut();
    setSession({ kind: 'idle' });
  }

  const missing = missingEnv(Boolean(apiUrl), Boolean(supabaseConfig));

  return (
    <main className="page">
      <h1>MiClub</h1>
      <p className="lead">Entrada de administradores. El socio no inicia sesión.</p>
      <p className="nav">
        <Link to="/">Estado de la API</Link>
      </p>

      {missing.length > 0 ? (
        <p className="banner" role="alert">
          Faltan variables de entorno: {missing.join(', ')}. Copiá <code>.env.example</code> a{' '}
          <code>.env.local</code> y completalas. Con los placeholders del ejemplo esta pantalla no llama a
          ningún servicio.
        </p>
      ) : (
        <form className="form" onSubmit={(event) => void onSubmit(event)}>
          <label>
            Email
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label>
            Contraseña
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          <label>
            Id del club
            <input
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={organizationId}
              onChange={(event) => setOrganizationId(event.target.value)}
              required
            />
          </label>
          <p className="hint">
            La API acepta el club solo si el usuario del token es miembro. El token viaja en{' '}
            <code>Authorization</code> y el id en <code>X-Organization-Id</code>.
          </p>
          <button type="submit" disabled={session.kind === 'loading'}>
            Entrar
          </button>
          {session.kind === 'in' ? (
            <button type="button" className="secondary" onClick={() => void signOut()}>
              Salir
            </button>
          ) : null}
          <SessionResult session={session} />
        </form>
      )}
    </main>
  );
}

function missingEnv(hasApi: boolean, hasSupabase: boolean): string[] {
  const missing: string[] = [];
  if (!hasApi) {
    missing.push('VITE_API_URL');
  }
  if (!hasSupabase) {
    missing.push('VITE_SUPABASE_URL');
    missing.push('VITE_SUPABASE_ANON_KEY');
  }
  return missing;
}

function isSessionBody(body: unknown): body is { organizationId: string; role: string } {
  return (
    typeof body === 'object' &&
    body !== null &&
    'organizationId' in body &&
    typeof body.organizationId === 'string' &&
    'role' in body &&
    typeof body.role === 'string'
  );
}

function SessionResult({ session }: { session: SessionView }) {
  if (session.kind === 'idle') {
    return null;
  }
  if (session.kind === 'loading') {
    return <p>Entrando…</p>;
  }
  if (session.kind === 'rejected') {
    return (
      <p className="banner" role="alert">
        {session.message}
      </p>
    );
  }
  return (
    <p className="pill ok" role="status">
      Club {session.organizationId} · {session.role}
    </p>
  );
}
