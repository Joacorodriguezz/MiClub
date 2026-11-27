export type ApiCheck = {
  httpStatus: number;
  body: unknown;
};

/**
 * URL pública de la API. Viene de `VITE_API_URL` (Vite la incrusta en el bundle).
 * Devuelve null si falta o no es http(s): la pantalla lo muestra, no revienta.
 */
export function readApiUrl(): string | null {
  const raw = import.meta.env.VITE_API_URL;
  if (typeof raw !== 'string') {
    return null;
  }
  const url = raw.trim().replace(/\/$/, '');
  if (!url || !/^https?:\/\//.test(url)) {
    return null;
  }
  return url;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isOrganizationId(value: string): boolean {
  return UUID_PATTERN.test(value.trim());
}

/**
 * Pide `GET /session` con el access token de Supabase y el club elegido.
 * No loguea el token ni el email.
 */
export async function getSession(accessToken: string, organizationId: string): Promise<ApiCheck> {
  const base = readApiUrl();
  if (!base) {
    throw new Error('Falta VITE_API_URL');
  }
  const response = await fetch(`${base}/session`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'X-Organization-Id': organizationId.trim(),
    },
  });
  return readJsonBody(response);
}

export async function getApiCheck(path: '/health' | '/ready'): Promise<ApiCheck> {
  const base = readApiUrl();
  if (!base) {
    throw new Error('Falta VITE_API_URL');
  }

  const response = await fetch(`${base}${path}`, {
    headers: { Accept: 'application/json' },
  });
  return readJsonBody(response);
}

async function readJsonBody(response: Response): Promise<ApiCheck> {
  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = null;
    }
  }
  return { httpStatus: response.status, body };
}
