import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where
} from 'firebase/firestore';
import { db, canliFirebaseAktifMi } from '@/src/veritabani/FirebaseIstemcisi';
import { firestoreHatasiniYonet, IslemTipi } from '@/src/veritabani/FirebaseHataYoneticisi';
import { hukukiSozlesmeleriGetir } from './hukukDeposu';
import type { DamgaDurumu, HukukiIslemTuru, HukukiOnayLogu } from './tipler';

const YEREL_LOGLAR_ANAHTARI = 'afyon_hukuki_onay_loglari_v2';
const DAMGA_API_YOLU = '/api/zaman-damgasi/damgala';
const API_ZAMAN_ASIMI_MS = 7500;

const IZINLI_FIRESTORE_ALANLARI = new Set([
  'kimlik',
  'sozlesmeTuru',
  'sozlesmeVersiyonu',
  'islemTuru',
  'tarihSaat',
  'ipAdresi',
  'cihazBilgisi',
  'onaylandiMi',
  'sunucuKayitZamani',
  'sunucuUtc',
  'ozetHash',
  'sozlesmeMetinHash',
  'tsaSaglayici',
  'tsaTokenBase64',
  'damgaDurumu',
  'sunucuImzasi',
  'ilgiliKayitId',
  'kullaniciKimlik',
  'kullaniciTelefon',
  'kullaniciAdSoyad',
  'ekDetay'
]);

export interface HukukiDelilGirdisi {
  sozlesmeTuru: string;
  sozlesmeVersiyonu?: string;
  islemTuru: HukukiIslemTuru;
  onaylandiMi?: boolean;
  ilgiliKayitId?: string;
  kullaniciKimlik?: string;
  kullaniciTelefon?: string;
  kullaniciAdSoyad?: string;
  sozlesmeMetni?: string;
  ekDetay?: Record<string, unknown>;
}

export interface HukukiDelilSonucu {
  basarili: boolean;
  firestoreYazildiMi: boolean;
  log: HukukiOnayLogu;
  hataMesaji?: string;
}

interface SunucuDamgaYaniti {
  basarili: boolean;
  ipAdresi?: string;
  sunucuUtc?: string;
  ozetHash?: string;
  sozlesmeMetinHash?: string;
  tsaSaglayici?: string;
  tsaTokenBase64?: string;
  damgaDurumu?: DamgaDurumu;
  sunucuImzasi?: string;
}

function yetkiHatasiMi(hata: unknown): boolean {
  if (!hata) return false;
  const mesaj = hata instanceof Error ? hata.message : String(hata);
  return (
    mesaj.includes('permission') ||
    mesaj.includes('insufficient') ||
    (hata as any)?.code === 'permission-denied'
  );
}

function benzersizKimlikUret(): string {
  const rastgele =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 10)
      : Math.random().toString(36).substring(2, 10);
  return `delil_${Date.now()}_${rastgele}`;
}

async function tarayiciSha256Hesapla(metin: string): Promise<string | undefined> {
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle && typeof TextEncoder !== 'undefined') {
      const baytlar = new TextEncoder().encode(metin);
      const ozet = await crypto.subtle.digest('SHA-256', baytlar);
      return Array.from(new Uint8Array(ozet))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }
  } catch {
    // Web Crypto kullanılamıyorsa sessizce undefined döner
  }
  return undefined;
}

function tanimsizAlanlariTemizle<T extends Record<string, unknown>>(nesne: T): T {
  const temiz: Record<string, unknown> = {};
  for (const anahtar of Object.keys(nesne)) {
    const deger = nesne[anahtar];
    if (deger === undefined) continue;
    if (
      deger !== null &&
      typeof deger === 'object' &&
      !Array.isArray(deger) &&
      Object.getPrototypeOf(deger) === Object.prototype
    ) {
      temiz[anahtar] = tanimsizAlanlariTemizle(deger as Record<string, unknown>);
    } else {
      temiz[anahtar] = deger;
    }
  }
  return temiz as T;
}

function firestoreBelgesiniSuz(belge: Record<string, unknown>): Record<string, unknown> {
  const suzulmus: Record<string, unknown> = {};
  for (const anahtar of Object.keys(belge)) {
    if (IZINLI_FIRESTORE_ALANLARI.has(anahtar) && belge[anahtar] !== undefined) {
      suzulmus[anahtar] = belge[anahtar];
    }
  }
  return suzulmus;
}

function yerelLoglariOku(): HukukiOnayLogu[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const mevcutHam = localStorage.getItem(YEREL_LOGLAR_ANAHTARI);
    const mevcut = mevcutHam ? JSON.parse(mevcutHam) : [];
    return Array.isArray(mevcut) ? mevcut : [];
  } catch {
    return [];
  }
}

function yerelLogaEkle(log: HukukiOnayLogu): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const liste = yerelLoglariOku().filter((l) => l.kimlik !== log.kimlik);
    liste.unshift(log);
    if (liste.length > 500) liste.pop();
    localStorage.setItem(YEREL_LOGLAR_ANAHTARI, JSON.stringify(liste));
  } catch (e) {
    console.warn('Yerel hukuki delil kaydı yazılamadı:', e);
  }
}

async function sunucudanDamgaAl(
  girdi: HukukiDelilGirdisi,
  sozlesmeMetinHash?: string
): Promise<SunucuDamgaYaniti | null> {
  if (typeof fetch !== 'function') return null;

  const kontrolcu = new AbortController();
  const zamanlayici = setTimeout(() => kontrolcu.abort(), API_ZAMAN_ASIMI_MS);

  try {
    const yanit = await fetch(DAMGA_API_YOLU, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sozlesmeTuru: girdi.sozlesmeTuru,
        sozlesmeVersiyonu: girdi.sozlesmeVersiyonu || '1.0.0',
        islemTuru: girdi.islemTuru,
        ilgiliKayitId: girdi.ilgiliKayitId,
        kullaniciKimlik: girdi.kullaniciKimlik,
        kullaniciTelefon: girdi.kullaniciTelefon,
        kullaniciAdSoyad: girdi.kullaniciAdSoyad,
        sozlesmeMetinHash,
        sozlesmeMetni: girdi.sozlesmeMetni,
        ekDetay: girdi.ekDetay
      }),
      signal: kontrolcu.signal
    });

    if (!yanit.ok) return null;
    const veri = (await yanit.json()) as SunucuDamgaYaniti;
    if (!veri || !veri.basarili) return null;
    return veri;
  } catch {
    return null;
  } finally {
    clearTimeout(zamanlayici);
  }
}

/**
 * Verilen hukuki/teslimat olayını sunucu üzerinden RFC 3161 + SHA-256 ile damgalar
 * ve `hukuki_onay_loglari/{kimlik}` yoluna yalnızca yeni kayıt (create) olarak `setDoc` ile yazar.
 * Asla update veya delete yapmaz, asla sahte IP üretmez, ekstra alan göndermez.
 */
export async function hukukiDelilDamgala(
  girdi: HukukiDelilGirdisi
): Promise<HukukiDelilSonucu> {
  const kimlik = benzersizKimlikUret();
  const sozlesmeVersiyonu = girdi.sozlesmeVersiyonu || '1.0.0';
  const onaylandiMi = Boolean(girdi.onaylandiMi ?? true);
  const tarihSaat = new Date().toLocaleString('tr-TR');
  const cihazBilgisi =
    typeof navigator !== 'undefined' && navigator.userAgent
      ? navigator.userAgent.substring(0, 120)
      : 'bilinmiyor';

  const sozlesmeMetinHash =
    girdi.sozlesmeMetni && girdi.sozlesmeMetni.trim() !== ''
      ? await tarayiciSha256Hesapla(girdi.sozlesmeMetni)
      : undefined;

  const sunucuYaniti = await sunucudanDamgaAl(girdi, sozlesmeMetinHash);
  const yerelUtc = new Date().toISOString();

  let ozetHash = sunucuYaniti?.ozetHash;
  if (!ozetHash) {
    ozetHash = await tarayiciSha256Hesapla(
      JSON.stringify({
        kimlik,
        sozlesmeTuru: girdi.sozlesmeTuru,
        sozlesmeVersiyonu,
        islemTuru: girdi.islemTuru,
        ilgiliKayitId: girdi.ilgiliKayitId || '',
        kullaniciKimlik: girdi.kullaniciKimlik || '',
        sozlesmeMetinHash: sozlesmeMetinHash || '',
        ekDetay: girdi.ekDetay || {},
        yerelUtc
      })
    );
  }

  const ipAdresi = sunucuYaniti?.ipAdresi || 'bilinmiyor';
  const sunucuUtc = sunucuYaniti?.sunucuUtc || yerelUtc;
  const damgaDurumu: DamgaDurumu = sunucuYaniti?.damgaDurumu || 'yerel_ozet';

  const temelLog: HukukiOnayLogu = tanimsizAlanlariTemizle({
    kimlik,
    sozlesmeTuru: girdi.sozlesmeTuru,
    sozlesmeVersiyonu,
    islemTuru: girdi.islemTuru,
    tarihSaat,
    ipAdresi,
    cihazBilgisi,
    onaylandiMi,
    sunucuUtc,
    ozetHash,
    sozlesmeMetinHash: sunucuYaniti?.sozlesmeMetinHash || sozlesmeMetinHash,
    tsaSaglayici: sunucuYaniti?.tsaSaglayici,
    tsaTokenBase64: sunucuYaniti?.tsaTokenBase64,
    damgaDurumu,
    sunucuImzasi: sunucuYaniti?.sunucuImzasi,
    ilgiliKayitId: girdi.ilgiliKayitId,
    kullaniciKimlik: girdi.kullaniciKimlik,
    kullaniciTelefon: girdi.kullaniciTelefon,
    kullaniciAdSoyad: girdi.kullaniciAdSoyad,
    ekDetay: girdi.ekDetay
  });

  yerelLogaEkle(temelLog);

  if (!canliFirebaseAktifMi()) {
    return {
      basarili: true,
      firestoreYazildiMi: false,
      log: temelLog
    };
  }

  const belgeYolu = `hukuki_onay_loglari/${kimlik}`;
  try {
    const firestoreBelgesi = firestoreBelgesiniSuz(
      tanimsizAlanlariTemizle({
        ...temelLog,
        sunucuKayitZamani: serverTimestamp()
      })
    );

    // merge olmadan setDoc -> yalnızca yeni belge oluşturma (create)
    await setDoc(doc(db, 'hukuki_onay_loglari', kimlik), firestoreBelgesi);

    return {
      basarili: true,
      firestoreYazildiMi: true,
      log: temelLog
    };
  } catch (hata: any) {
    if (yetkiHatasiMi(hata)) {
      firestoreHatasiniYonet(hata, IslemTipi.CREATE, belgeYolu);
    }
    console.warn(`Hukuki delil Firestore yazma hatası (${belgeYolu}):`, hata);
    return {
      basarili: false,
      firestoreYazildiMi: false,
      log: temelLog,
      hataMesaji: hata?.message || 'Hukuki delil Firestore kaydı yapılamadı.'
    };
  }
}

/**
 * Kurye kayıt sözleşmelerinin üçünü (taşıma sözleşmesi, KVKK, ehliyet/araç beyanı) ayrı ayrı damgalar.
 */
export async function kuryeKayitSozlesmeleriniDamgala(param: {
  kullaniciKimlik: string;
  kullaniciTelefon?: string;
  kullaniciAdSoyad?: string;
  ekDetay?: Record<string, unknown>;
  sozlesmeTurleri?: string[];
}): Promise<HukukiDelilSonucu[]> {
  const sozlesmeler = hukukiSozlesmeleriGetir();
  const hedefler = param.sozlesmeTurleri && param.sozlesmeTurleri.length > 0
    ? param.sozlesmeTurleri
    : ['kurye_kayit_sozlesmesi', 'kvkk_aydinlatma', 'kurye_ehliyet_arac_beyani'];

  return Promise.all(
    hedefler.map((tur) => {
      const sozlesme = sozlesmeler[tur];
      return hukukiDelilDamgala({
        sozlesmeTuru: tur,
        sozlesmeVersiyonu: sozlesme?.versiyon || '1.0.0',
        islemTuru: 'kayit',
        onaylandiMi: true,
        ilgiliKayitId: param.kullaniciKimlik,
        kullaniciKimlik: param.kullaniciKimlik,
        kullaniciTelefon: param.kullaniciTelefon,
        kullaniciAdSoyad: param.kullaniciAdSoyad,
        sozlesmeMetni: sozlesme?.icerik,
        ekDetay: param.ekDetay
      });
    })
  );
}

/**
 * Kurye kaynaklı sipariş iptali / teslim edilemedi beyanını zaman damgası ile mühürler.
 */
export async function kuryeIptalBeyaniDamgala(param: {
  siparisKodu: string;
  kuryeId: string;
  kuryeAdSoyad: string;
  kuryeTelefon?: string;
  gerekce: string;
  detayNot?: string;
  kaynak?: string;
}): Promise<HukukiDelilSonucu> {
  const sozlesmeler = hukukiSozlesmeleriGetir();
  const iptalSozlesmesi = sozlesmeler.iptal_iade_kosullari;
  return hukukiDelilDamgala({
    sozlesmeTuru: 'iptal_iade_kosullari',
    sozlesmeVersiyonu: iptalSozlesmesi?.versiyon || '1.0.0',
    islemTuru: 'iptal',
    onaylandiMi: true,
    ilgiliKayitId: param.siparisKodu,
    kullaniciKimlik: param.kuryeId,
    kullaniciTelefon: param.kuryeTelefon,
    kullaniciAdSoyad: param.kuryeAdSoyad,
    sozlesmeMetni: iptalSozlesmesi?.icerik,
    ekDetay: {
      gerekce: param.gerekce,
      detayNot: param.detayNot || '',
      kaynak: param.kaynak || 'siparisler'
    }
  });
}

/**
 * Aktif kuryenin Firestore ve yerel depodaki zaman damgalı onay loglarını getirir.
 */
export async function kuryeOnayLoglariniGetir(
  kuryeId: string,
  kuryeTelefon: string = ''
): Promise<HukukiOnayLogu[]> {
  const harita = new Map<string, HukukiOnayLogu>();
  const telefonSon10 = kuryeTelefon.replace(/\D/g, '').slice(-10);

  for (const log of yerelLoglariOku()) {
    const logTelSon10 = String(log.kullaniciTelefon || '').replace(/\D/g, '').slice(-10);
    if (
      (kuryeId && log.kullaniciKimlik === kuryeId) ||
      (telefonSon10 && logTelSon10 === telefonSon10)
    ) {
      harita.set(log.kimlik, log);
    }
  }

  if (canliFirebaseAktifMi() && kuryeId) {
    try {
      const q = query(
        collection(db, 'hukuki_onay_loglari'),
        where('kullaniciKimlik', '==', kuryeId)
      );
      const snap = await getDocs(q);
      snap.forEach((belge) => {
        const veri = belge.data() as HukukiOnayLogu;
        const logObj: HukukiOnayLogu = {
          ...veri,
          kimlik: veri.kimlik || belge.id
        };
        harita.set(logObj.kimlik, logObj);
      });
    } catch (hata) {
      if (yetkiHatasiMi(hata)) {
        firestoreHatasiniYonet(hata, IslemTipi.LIST, 'hukuki_onay_loglari');
      }
    }
  }

  return Array.from(harita.values()).sort((a, b) => {
    const tA = a.sunucuUtc || a.tarihSaat || '';
    const tB = b.sunucuUtc || b.tarihSaat || '';
    return tB.localeCompare(tA);
  });
}

function htmlKacis(deger: unknown): string {
  return String(deger ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function blobIndir(blob: Blob, dosyaAdi: string): void {
  if (typeof document === 'undefined' || typeof URL === 'undefined') return;
  const nesneUrl = URL.createObjectURL(blob);
  const baglanti = document.createElement('a');
  baglanti.href = nesneUrl;
  baglanti.download = dosyaAdi;
  baglanti.style.display = 'none';
  document.body.appendChild(baglanti);
  baglanti.click();
  setTimeout(() => {
    document.body.removeChild(baglanti);
    URL.revokeObjectURL(nesneUrl);
  }, 1500);
}

/**
 * Zaman damgalı hukuki onay kaydını ve sözleşme metnini bağımsız doğrulanabilir `.html` belge olarak indirir.
 */
export function muhurluHtmlBelgeIndir(
  log: HukukiOnayLogu,
  sozlesmeBaslik?: string,
  sozlesmeIcerik?: string
): void {
  const sozlesmeler = hukukiSozlesmeleriGetir();
  const kayitliSozlesme = sozlesmeler[log.sozlesmeTuru];
  const baslik = sozlesmeBaslik || kayitliSozlesme?.baslik || log.sozlesmeTuru;
  const icerik = sozlesmeIcerik || kayitliSozlesme?.icerik || 'Sözleşme metni kayıt sırasında özetlenmiştir.';
  const damgaEtiketi =
    log.damgaDurumu === 'rfc3161_onayli'
      ? 'RFC 3161 TSA Onaylı'
      : log.damgaDurumu === 'sunucu_muhurlu'
        ? 'Sunucu HMAC Mühürlü'
        : 'Yerel SHA-256 Özet';

  const html = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <title>${htmlKacis(baslik)} — Hukuki Zaman Damgası Belgesi</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #140519; color: #f3e8ff; margin: 0; padding: 24px; }
    .kart { max-width: 820px; margin: 0 auto; background: #1d0a20; border: 1px solid #4b1d55; border-radius: 16px; padding: 24px; }
    h1 { color: #fbbf24; font-size: 20px; margin: 0 0 4px 0; }
    .alt { color: #d8b4fe; font-size: 13px; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; }
    th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #3e1646; word-break: break-all; }
    th { width: 210px; color: #c084fc; }
    .metin { background: #120614; border: 1px solid #3e1646; border-radius: 12px; padding: 16px; white-space: pre-wrap; font-size: 13px; line-height: 1.6; }
    .rozet { display: inline-block; background: #064e3b; color: #6ee7b7; border: 1px solid #10b981; padding: 3px 10px; border-radius: 999px; font-weight: 700; font-size: 12px; }
  </style>
</head>
<body>
  <div class="kart">
    <h1>Afyon Ev Lezzetleri — Hukuki Onay ve Zaman Damgası Belgesi</h1>
    <div class="alt">${htmlKacis(baslik)} (v${htmlKacis(log.sozlesmeVersiyonu)}) <span class="rozet">${htmlKacis(damgaEtiketi)}</span></div>
    <table>
      <tr><th>Delil Kimliği</th><td>${htmlKacis(log.kimlik)}</td></tr>
      <tr><th>Kurye / Kullanıcı</th><td>${htmlKacis(log.kullaniciAdSoyad || '-')} (${htmlKacis(log.kullaniciTelefon || '-')})</td></tr>
      <tr><th>Kullanıcı Kimliği</th><td>${htmlKacis(log.kullaniciKimlik || '-')}</td></tr>
      <tr><th>İşlem / Sözleşme Türü</th><td>${htmlKacis(log.islemTuru)} / ${htmlKacis(log.sozlesmeTuru)}</td></tr>
      <tr><th>İlgili Kayıt Kodu</th><td>${htmlKacis(log.ilgiliKayitId || '-')}</td></tr>
      <tr><th>Sunucu UTC Zamanı</th><td>${htmlKacis(log.sunucuUtc || log.tarihSaat)}</td></tr>
      <tr><th>Yerel Tarih / Saat</th><td>${htmlKacis(log.tarihSaat)}</td></tr>
      <tr><th>Gerçek İstemci IP</th><td>${htmlKacis(log.ipAdresi)}</td></tr>
      <tr><th>TSA Sağlayıcı</th><td>${htmlKacis(log.tsaSaglayici || '-')}</td></tr>
      <tr><th>Veri Özeti (SHA-256)</th><td>${htmlKacis(log.ozetHash || '-')}</td></tr>
      <tr><th>Sözleşme Metin SHA-256</th><td>${htmlKacis(log.sozlesmeMetinHash || '-')}</td></tr>
      <tr><th>Sunucu HMAC Mührü</th><td>${htmlKacis(log.sunucuImzasi || '-')}</td></tr>
      <tr><th>Cihaz Bilgisi</th><td>${htmlKacis(log.cihazBilgisi)}</td></tr>
    </table>
    <div class="metin">${htmlKacis(icerik)}</div>
  </div>
</body>
</html>`;

  const guvenliDosyaAdi = `${log.sozlesmeTuru}_${log.kimlik}.html`.replace(/[^a-zA-Z0-9._-]/g, '_');
  blobIndir(new Blob([html], { type: 'text/html;charset=utf-8' }), guvenliDosyaAdi);
}

/**
 * RFC 3161 TSA token baytlarını `.tsr` dosyası olarak indirir.
 */
export function tsrDosyasiIndir(log: HukukiOnayLogu): boolean {
  if (!log.tsaTokenBase64) return false;
  try {
    const ikili = atob(log.tsaTokenBase64);
    const baytlar = new Uint8Array(ikili.length);
    for (let i = 0; i < ikili.length; i++) {
      baytlar[i] = ikili.charCodeAt(i);
    }
    const guvenliDosyaAdi = `${log.sozlesmeTuru}_${log.kimlik}.tsr`.replace(/[^a-zA-Z0-9._-]/g, '_');
    blobIndir(new Blob([baytlar], { type: 'application/timestamp-reply' }), guvenliDosyaAdi);
    return true;
  } catch {
    return false;
  }
}
