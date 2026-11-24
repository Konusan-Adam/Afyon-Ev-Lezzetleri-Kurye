import crypto from 'crypto';
import type { Request } from 'express';
import { rfc3161IstekOlustur, rfc3161YanitDogrula } from './Rfc3161Asn1Yardimcisi';

export type DamgaDurumu = 'rfc3161_onayli' | 'sunucu_muhurlu' | 'yerel_ozet';

export interface ZamanDamgasiIstegi {
  sozlesmeTuru: string;
  sozlesmeVersiyonu?: string;
  islemTuru: string;
  ilgiliKayitId?: string;
  kullaniciKimlik?: string;
  kullaniciTelefon?: string;
  kullaniciAdSoyad?: string;
  sozlesmeMetni?: string;
  sozlesmeMetinHash?: string;
  ekDetay?: Record<string, unknown>;
}

export interface ZamanDamgasiYaniti {
  basarili: boolean;
  ipAdresi: string;
  sunucuUtc: string;
  ozetHash: string;
  sozlesmeMetinHash?: string;
  tsaSaglayici: string;
  tsaTokenBase64?: string;
  damgaDurumu: DamgaDurumu;
  sunucuImzasi: string;
}

const TSA_ZAMAN_ASIMI_MS = 3200;

const TSA_SAGLAYICILARI = [
  { ad: 'freetsa.org', url: 'https://freetsa.org/tsr' },
  { ad: 'digicert.com', url: 'http://timestamp.digicert.com' }
] as const;

// Ortam değişkeni tanımlı değilse süreç ömrü boyunca bellekte tutulan kriptografik anahtar
const SUNUCU_MUHUR_ANAHTARI =
  process.env.ZAMAN_DAMGASI_GIZLI_ANAHTAR || crypto.randomBytes(32).toString('hex');

function ipTemizle(hamIp: string | undefined | null): string {
  if (!hamIp) return '';
  let temiz = hamIp.trim();
  if (temiz.startsWith('::ffff:')) {
    temiz = temiz.slice(7);
  }
  // Eğer port eki varsa (örn. IPv4:port) ayır
  if (/^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(temiz)) {
    temiz = temiz.split(':')[0];
  }
  return temiz;
}

/**
 * İstek başlıklarından ve soketten gerçek istemci IP adresini çıkarır.
 * Asla sahte / rastgele IP üretmez.
 */
export function gercekIstemciIpGetir(req: Request): string {
  const xForwardedFor = req.headers['x-forwarded-for'];
  if (typeof xForwardedFor === 'string' && xForwardedFor.trim() !== '') {
    const ilkIp = ipTemizle(xForwardedFor.split(',')[0]);
    if (ilkIp) return ilkIp;
  } else if (Array.isArray(xForwardedFor) && xForwardedFor.length > 0) {
    const ilkIp = ipTemizle(xForwardedFor[0].split(',')[0]);
    if (ilkIp) return ilkIp;
  }

  const cfConnectingIp = req.headers['cf-connecting-ip'];
  if (typeof cfConnectingIp === 'string') {
    const temiz = ipTemizle(cfConnectingIp);
    if (temiz) return temiz;
  }

  const xRealIp = req.headers['x-real-ip'];
  if (typeof xRealIp === 'string') {
    const temiz = ipTemizle(xRealIp);
    if (temiz) return temiz;
  }

  const reqIp = ipTemizle(req.ip);
  if (reqIp) return reqIp;

  const socketIp = ipTemizle(req.socket?.remoteAddress);
  if (socketIp) return socketIp;

  return 'bilinmiyor';
}

export function sha256HexHesapla(metin: string): string {
  return crypto.createHash('sha256').update(metin, 'utf8').digest('hex');
}

function deterministikSiraliNesne(deger: unknown): unknown {
  if (deger === null || typeof deger !== 'object') return deger;
  if (Array.isArray(deger)) return deger.map(deterministikSiraliNesne);

  const sirali: Record<string, unknown> = {};
  const anahtarlar = Object.keys(deger as Record<string, unknown>).sort();
  for (const anahtar of anahtarlar) {
    const v = (deger as Record<string, unknown>)[anahtar];
    if (v !== undefined) {
      sirali[anahtar] = deterministikSiraliNesne(v);
    }
  }
  return sirali;
}

async function tsaSunucusunaDamgalat(
  url: string,
  istekBuffer: Buffer
): Promise<{ basarili: boolean; tokenBase64?: string }> {
  const kontrolcu = new AbortController();
  const zamanlayici = setTimeout(() => kontrolcu.abort(), TSA_ZAMAN_ASIMI_MS);

  try {
    const yanit = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/timestamp-query',
        Accept: 'application/timestamp-reply'
      },
      body: new Uint8Array(istekBuffer),
      signal: kontrolcu.signal
    });

    if (!yanit.ok) {
      return { basarili: false };
    }

    const arrayBuf = await yanit.arrayBuffer();
    const tsrBuffer = Buffer.from(arrayBuf);
    const dogrulama = rfc3161YanitDogrula(tsrBuffer);

    if (dogrulama.gecerliMi && dogrulama.tokenBase64) {
      return { basarili: true, tokenBase64: dogrulama.tokenBase64 };
    }
    return { basarili: false };
  } catch {
    return { basarili: false };
  } finally {
    clearTimeout(zamanlayici);
  }
}

export async function hukukiOlayDamgala(
  istek: ZamanDamgasiIstegi,
  gercekIp: string
): Promise<ZamanDamgasiYaniti> {
  const sunucuUtc = new Date().toISOString();

  const sozlesmeMetinHash =
    typeof istek.sozlesmeMetinHash === 'string' && /^[a-f0-9]{64}$/i.test(istek.sozlesmeMetinHash)
      ? istek.sozlesmeMetinHash.toLowerCase()
      : typeof istek.sozlesmeMetni === 'string' && istek.sozlesmeMetni.trim() !== ''
        ? sha256HexHesapla(istek.sozlesmeMetni)
        : undefined;

  const kanonikVeri = deterministikSiraliNesne({
    sozlesmeTuru: istek.sozlesmeTuru,
    sozlesmeVersiyonu: istek.sozlesmeVersiyonu || '1.0.0',
    islemTuru: istek.islemTuru,
    ilgiliKayitId: istek.ilgiliKayitId || '',
    kullaniciKimlik: istek.kullaniciKimlik || '',
    kullaniciTelefon: istek.kullaniciTelefon || '',
    kullaniciAdSoyad: istek.kullaniciAdSoyad || '',
    sozlesmeMetinHash: sozlesmeMetinHash || '',
    ekDetay: istek.ekDetay || {},
    ipAdresi: gercekIp,
    sunucuUtc
  });

  const ozetHash = sha256HexHesapla(JSON.stringify(kanonikVeri));
  const sunucuImzasi = crypto
    .createHmac('sha256', SUNUCU_MUHUR_ANAHTARI)
    .update(`${ozetHash}|${sunucuUtc}|${gercekIp}`)
    .digest('hex');

  const { istekBuffer } = rfc3161IstekOlustur(ozetHash);

  for (const saglayici of TSA_SAGLAYICILARI) {
    const tsaSonucu = await tsaSunucusunaDamgalat(saglayici.url, istekBuffer);
    if (tsaSonucu.basarili && tsaSonucu.tokenBase64) {
      return {
        basarili: true,
        ipAdresi: gercekIp,
        sunucuUtc,
        ozetHash,
        ...(sozlesmeMetinHash ? { sozlesmeMetinHash } : {}),
        tsaSaglayici: saglayici.ad,
        tsaTokenBase64: tsaSonucu.tokenBase64,
        damgaDurumu: 'rfc3161_onayli',
        sunucuImzasi
      };
    }
  }

  // Harici TSA sağlayıcıları yanıt veremediğinde kriptografik sunucu mührü döner
  return {
    basarili: true,
    ipAdresi: gercekIp,
    sunucuUtc,
    ozetHash,
    ...(sozlesmeMetinHash ? { sozlesmeMetinHash } : {}),
    tsaSaglayici: 'afyon-sunucu-muhru',
    damgaDurumu: 'sunucu_muhurlu',
    sunucuImzasi
  };
}
