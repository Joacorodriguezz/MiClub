import { createApp } from './app';
import { buildCorsOptions, validateProductionEnv } from './config/cors';

/**
 * Punto de entrada del proceso. Levanta el servidor HTTP.
 * Render inyecta PORT; en local usa 3000. Bind 0.0.0.0 para el Web Service.
 */
const productionEnvError = validateProductionEnv();
if (productionEnvError) {
  console.error(productionEnvError);
  process.exit(1);
}

try {
  buildCorsOptions();
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Error al configurar CORS.');
  process.exit(1);
}

const PORT = Number(process.env.PORT ?? 3000);
const app = createApp();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`MiClub backend escuchando en http://0.0.0.0:${PORT}`);
});
