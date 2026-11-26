import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { zamanDamgasiRotasiOlustur } from './server/ZamanDamgasi/zamanDamgasiRotasi';

const APK_CIKTI_DIZIN = path.resolve(process.cwd(), 'android', 'cikti');
const APK_DOSYA_YOLU = path.join(APK_CIKTI_DIZIN, 'afyon-kurye.apk');
const APK_META_YOLU = path.join(APK_CIKTI_DIZIN, 'apk-meta.json');

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

  // Android APK ve sürüm meta dosyası indirme rotaları (public/ dışında android/cikti/'den servis edilir)
  const apkMetaGonder = (_req: express.Request, res: express.Response) => {
    if (!fs.existsSync(APK_META_YOLU)) {
      res.status(404).json({ hata: 'apk-meta.json henüz oluşturulmadı.' });
      return;
    }
    res.setHeader('Cache-Control', 'no-store');
    res.type('application/json').sendFile(APK_META_YOLU);
  };

  const apkDosyasiGonder = (_req: express.Request, res: express.Response) => {
    if (!fs.existsSync(APK_DOSYA_YOLU)) {
      res.status(404).json({ hata: 'afyon-kurye.apk henüz derlenmedi.' });
      return;
    }
    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.setHeader('Content-Disposition', 'attachment; filename="afyon-kurye.apk"');
    res.setHeader('Cache-Control', 'no-store');
    res.sendFile(APK_DOSYA_YOLU);
  };

  app.get('/apk-meta.json', apkMetaGonder);
  app.get('/api/apk/meta', apkMetaGonder);
  app.get('/afyon-kurye.apk', apkDosyasiGonder);
  app.get('/api/apk/indir', apkDosyasiGonder);

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
