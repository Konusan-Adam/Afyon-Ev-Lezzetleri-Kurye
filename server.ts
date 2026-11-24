import express from 'express';
import { createServer as createViteServer } from 'vite';
import { zamanDamgasiRotasiOlustur } from './server/ZamanDamgasi/zamanDamgasiRotasi';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.set('trust proxy', true);
  app.use(express.json({ limit: '256kb' }));

  // Health and ping routes
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // RFC 3161 + SHA-256 Zaman Damgası Rotası
  app.use('/api/zaman-damgasi', zamanDamgasiRotasiOlustur());

  if (process.env.NODE_ENV === 'production') {
    app.use(express.static('dist'));
    app.get('*', (_req, res) => {
      res.sendFile('dist/index.html', { root: '.' });
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
