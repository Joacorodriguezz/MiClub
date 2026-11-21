import { useEffect, useState } from 'react';

type EstadoApi = 'consultando' | 'ok' | 'sin-conexion' | 'sin-configurar';

const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '');

/**
 * Pantalla provisoria: confirma que el frontend compila y que alcanza a la API
 * (CORS incluido). Se reemplaza al implementar el panel de administración.
 */
export function App() {
  const [estado, setEstado] = useState<EstadoApi>(API_URL ? 'consultando' : 'sin-configurar');

  useEffect(() => {
    if (!API_URL) return;
    const controlador = new AbortController();
    fetch(`${API_URL}/health`, { signal: controlador.signal })
      .then((respuesta) => setEstado(respuesta.ok ? 'ok' : 'sin-conexion'))
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setEstado('sin-conexion');
        }
      });
    return () => controlador.abort();
  }, []);

  const mensajes: Record<EstadoApi, string> = {
    consultando: 'Consultando la API… (puede tardar hasta un minuto si estaba dormida)',
    ok: 'API conectada',
    'sin-conexion': 'No se pudo conectar con la API',
    'sin-configurar': 'Falta configurar VITE_API_URL',
  };

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 480, margin: '4rem auto', padding: '0 1rem' }}>
      <h1>MiClub</h1>
      <p role="status">{mensajes[estado]}</p>
    </main>
  );
}
