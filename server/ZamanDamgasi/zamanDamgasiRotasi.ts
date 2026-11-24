import { Router, type Request, type Response } from 'express';
import {
  gercekIstemciIpGetir,
  hukukiOlayDamgala,
  type ZamanDamgasiIstegi
} from './ZamanDamgasiServisi';

const GECERLI_ISLEM_TURLERI = new Set([
  'kayit',
  'siparis',
  'cerez_onayi',
  'ozel_onay',
  'teslimat',
  'hakedis'
]);

function temizMetin(deger: unknown, maksUzunluk: number): string | undefined {
  if (typeof deger !== 'string') return undefined;
  const temiz = deger.trim();
  if (!temiz) return undefined;
  return temiz.slice(0, maksUzunluk);
}

function duzNesneMi(deger: unknown): deger is Record<string, unknown> {
  return deger !== null && typeof deger === 'object' && !Array.isArray(deger);
}

function ekDetayTemizle(ham: unknown): Record<string, unknown> | undefined {
  if (!duzNesneMi(ham)) return undefined;
  const yasakli = new Set(['__proto__', 'constructor', 'prototype']);
  const sonuc: Record<string, unknown> = {};
  let sayac = 0;

  for (const anahtar of Object.keys(ham)) {
    if (yasakli.has(anahtar) || sayac >= 25) continue;
    const deger = ham[anahtar];
    if (
      typeof deger === 'string' ||
      typeof deger === 'number' ||
      typeof deger === 'boolean'
    ) {
      sonuc[anahtar.slice(0, 64)] =
        typeof deger === 'string' ? deger.slice(0, 500) : deger;
      sayac++;
    }
  }
  return Object.keys(sonuc).length > 0 ? sonuc : undefined;
}

export function zamanDamgasiRotasiOlustur(): Router {
  const router = Router();

  router.post('/damgala', async (req: Request, res: Response) => {
    try {
      if (!duzNesneMi(req.body)) {
        res.status(400).json({
          basarili: false,
          hata: 'Geçersiz istek gövdesi.'
        });
        return;
      }

      const sozlesmeTuru = temizMetin(req.body.sozlesmeTuru, 100);
      const islemTuru = temizMetin(req.body.islemTuru, 40);

      if (!sozlesmeTuru || !islemTuru || !GECERLI_ISLEM_TURLERI.has(islemTuru)) {
        res.status(400).json({
          basarili: false,
          hata: 'Geçerli sozlesmeTuru ve islemTuru alanları zorunludur.'
        });
        return;
      }

      const istekVerisi: ZamanDamgasiIstegi = {
        sozlesmeTuru,
        sozlesmeVersiyonu: temizMetin(req.body.sozlesmeVersiyonu, 32) || '1.0.0',
        islemTuru,
        ilgiliKayitId: temizMetin(req.body.ilgiliKayitId, 128),
        kullaniciKimlik: temizMetin(req.body.kullaniciKimlik, 128),
        kullaniciTelefon: temizMetin(req.body.kullaniciTelefon, 32),
        kullaniciAdSoyad: temizMetin(req.body.kullaniciAdSoyad, 120),
        sozlesmeMetni: temizMetin(req.body.sozlesmeMetni, 50000),
        sozlesmeMetinHash: temizMetin(req.body.sozlesmeMetinHash, 64),
        ekDetay: ekDetayTemizle(req.body.ekDetay)
      };

      const gercekIp = gercekIstemciIpGetir(req);
      const sonuc = await hukukiOlayDamgala(istekVerisi, gercekIp);

      res.json(sonuc);
    } catch (hata: any) {
      console.error('Zaman damgası oluşturma hatası:', hata);
      res.status(500).json({
        basarili: false,
        hata: 'Zaman damgası servisi geçici olarak yanıt veremedi.'
      });
    }
  });

  return router;
}
