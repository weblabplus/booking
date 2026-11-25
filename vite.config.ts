import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import notifyHandler from './api/notify';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Το `vite dev` δεν εκτελεί Vercel Functions — φορτώνουμε τα ίδια env vars
  // στη Node process και σερβίρουμε το /api/notify από το dev middleware.
  const env = loadEnv(mode, process.cwd(), '');
  for (const key of ['BREVO_API_KEY', 'SENDER_EMAIL', 'SENDER_NAME', 'CLINIC_EMAIL']) {
    if (!process.env[key] && env[key]) process.env[key] = env[key];
  }

  return {
    plugins: [
      react(),
      {
        name: 'dev-api-notify',
        configureServer(server) {
          server.middlewares.use('/api/notify', (req, res, next) => {
            if (req.url && req.url !== '/' && !req.url.startsWith('?')) {
              next();
              return;
            }
            if (req.method !== 'POST') {
              res.statusCode = 405;
              res.setHeader('content-type', 'application/json; charset=utf-8');
              res.end(JSON.stringify({ error: 'Method not allowed' }));
              return;
            }
            notifyHandler(req, res).catch((error: unknown) => {
              console.error('[dev-api] notify failed:', error);
              if (!res.writableEnded) {
                res.statusCode = 500;
                res.setHeader('content-type', 'application/json; charset=utf-8');
                res.end(JSON.stringify({ error: 'Internal error' }));
              }
            });
          });
        },
      },
    ],
  };
});
