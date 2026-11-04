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

export async function getApiCheck(path: '/health' | '/ready'): Promise<ApiCheck> {
  const base = readApiUrl();
  if (!base) {
    throw new Error('Falta VITE_API_URL');
  }

  const response = await fetch(`${base}${path}`, {
    headers: { Accept: 'application/json' },
  });
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
