import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db, canliFirebaseAktifMi } from '@/src/veritabani/FirebaseIstemcisi';
import { firestoreHatasiniYonet, IslemTipi } from '@/src/veritabani/FirebaseHataYoneticisi';
import { hukukiSozlesmeleriGetir } from './hukukDeposu';
import type { DamgaDurumu, HukukiIslemTuru, HukukiOnayLogu } from './tipler';

const YEREL_LOGLAR_ANAHTARI = 'afyon_hukuki_onay_loglari_v2';
const DAMGA_API_YOLU = '/api/zaman-damgasi/damgala';
const API_ZAMAN_ASIMI_MS = 7500;

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

function yerelLogaEkle(log: HukukiOnayLogu): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const mevcutHam = localStorage.getItem(YEREL_LOGLAR_ANAHTARI);
    const mevcut: HukukiOnayLogu[] = mevcutHam ? JSON.parse(mevcutHam) : [];
    const liste = Array.isArray(mevcut) ? mevcut : [];
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
 * Asla update veya delete yapmaz, asla sahte IP üretmez.
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

  // Yalnızca izinli alanlardan oluşan belge gövdesi
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
    const firestoreBelgesi = tanimsizAlanlariTemizle({
      ...temelLog,
      sunucuKayitZamani: serverTimestamp()
    });

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
 * Kurye kayıt ve taşıma sözleşmesi + KVKK aydınlatma onaylarını ayrı ayrı damgalar.
 */
export async function kuryeKayitSozlesmeleriniDamgala(param: {
  kullaniciKimlik: string;
  kullaniciTelefon?: string;
  kullaniciAdSoyad?: string;
  ekDetay?: Record<string, unknown>;
}): Promise<HukukiDelilSonucu[]> {
  const sozlesmeler = hukukiSozlesmeleriGetir();
  const kuryeSozlesmesi = sozlesmeler.kurye_kayit_sozlesmesi;
  const kvkkSozlesmesi = sozlesmeler.kvkk_aydinlatma;

  return Promise.all([
    hukukiDelilDamgala({
      sozlesmeTuru: 'kurye_kayit_sozlesmesi',
      sozlesmeVersiyonu: kuryeSozlesmesi?.versiyon || '1.0.0',
      islemTuru: 'kayit',
      onaylandiMi: true,
      ilgiliKayitId: param.kullaniciKimlik,
      kullaniciKimlik: param.kullaniciKimlik,
      kullaniciTelefon: param.kullaniciTelefon,
      kullaniciAdSoyad: param.kullaniciAdSoyad,
      sozlesmeMetni: kuryeSozlesmesi?.icerik,
      ekDetay: param.ekDetay
    }),
    hukukiDelilDamgala({
      sozlesmeTuru: 'kvkk_aydinlatma',
      sozlesmeVersiyonu: kvkkSozlesmesi?.versiyon || '1.0.0',
      islemTuru: 'kayit',
      onaylandiMi: true,
      ilgiliKayitId: param.kullaniciKimlik,
      kullaniciKimlik: param.kullaniciKimlik,
      kullaniciTelefon: param.kullaniciTelefon,
      kullaniciAdSoyad: param.kullaniciAdSoyad,
      sozlesmeMetni: kvkkSozlesmesi?.icerik,
      ekDetay: param.ekDetay
    })
  ]);
}
