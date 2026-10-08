import { createApp } from './app';

/**
 * Punto de entrada del proceso. Levanta el servidor HTTP.
 * Render inyecta PORT; en local usa 3000. Bind 0.0.0.0 para el Web Service.
 */
const PORT = Number(process.env.PORT ?? 3000);

const app = createApp();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`MiClub backend escuchando en http://0.0.0.0:${PORT}`);
});
