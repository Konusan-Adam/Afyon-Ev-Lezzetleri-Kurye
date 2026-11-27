import { collection, onSnapshot } from 'firebase/firestore';
import {
  HukukiSozlesme,
  HukukiOnayLogu,
  CerezTercihleri,
  SozlesmeKonumu
} from './tipler';
import { db, canliFirebaseAktifMi } from '@/src/veritabani/FirebaseIstemcisi';
import {
  koleksiyonGetir,
  belgeKaydet,
  belgeSil
} from '@/src/veritabani/FirebaseKoleksiyonServisi';
import { firestoreHatasiniYonet, IslemTipi } from '@/src/veritabani/FirebaseHataYoneticisi';

const YEREL_LOGLAR_ANAHTARI = 'afyon_hukuki_onay_loglari_v2';
const YEREL_CEREZ_ANAHTARI = 'afyon_cerez_tercihleri_v1';
const ESKI_SOZLESMELER_ANAHTARI = 'afyon_hukuki_sozlesmeler_v3';
const ESKI_SILINENLER_ANAHTARI = 'afyon_silinen_sozlesmeler_v1';

export type HedefEkranTipi = 'kurye_basvuru' | 'kayit' | 'siparis' | 'asci_basvuru' | 'tumu';

// Yalnızca anlık Firestore onSnapshot görünümünün bellek içi kopyasıdır; sabit veya yerel önbellekten veri üretmez.
let bellektekiSozlesmeler: Record<string, HukukiSozlesme> = {};

function eskiYerelSozlesmeOnbelleginiTemizle(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(ESKI_SOZLESMELER_ANAHTARI);
    localStorage.removeItem(ESKI_SILINENLER_ANAHTARI);
  } catch {
    // Yoksay
  }
}

if (typeof window !== 'undefined') {
  eskiYerelSozlesmeOnbelleginiTemizle();
}

function belgeyiSozlesmeyeDonustur(ham: Record<string, any>, belgeId: string): HukukiSozlesme {
  const tur = String(ham.tur || belgeId).trim();
  return {
    tur,
    baslik: String(ham.baslik || tur),
    kisaBaslik: String(ham.kisaBaslik || ham.baslik || tur),
    icerik: String(ham.icerik || ''),
    versiyon: String(ham.versiyon || '1.0.0'),
    guncellenmeTarihi: String(ham.guncellenmeTarihi || ''),
    konum: (ham.konum as SozlesmeKonumu) || 'genel',
    zorunluMu: ham.zorunluMu !== false,
    aktifMi: ham.aktifMi !== false,
    hedefRoller: Array.isArray(ham.hedefRoller)
      ? ham.hedefRoller.map((r: unknown) => String(r).trim()).filter(Boolean)
      : undefined,
    silinebilirMi: ham.silinebilirMi !== false
  };
}

function sozlesmeleriSirala(liste: HukukiSozlesme[]): HukukiSozlesme[] {
  return [...liste].sort((a, b) => {
    if (a.zorunluMu !== b.zorunluMu) {
      return a.zorunluMu ? -1 : 1;
    }
    return a.baslik.localeCompare(b.baslik, 'tr');
  });
}

/**
 * Tek gerçek kaynak olan Firestore `sozlesmeler` belgesinin ilgili ekrana uyup uymadığını kontrol eder.
 * `aktifMi === false` ise tüm kayıt/onay ekranlarında gizlenir.
 */
export function sozlesmeEkranUygunMu(
  sozlesme: HukukiSozlesme,
  ekran: HedefEkranTipi
): boolean {
  if (sozlesme.aktifMi === false) return false;
  if (ekran === 'tumu') return true;

  const tur = String(sozlesme.tur || '').trim();
  const konum = String(sozlesme.konum || '').trim();
  const roller = Array.isArray(sozlesme.hedefRoller) ? sozlesme.hedefRoller : [];

  if (ekran === 'kurye_basvuru') {
    if (tur === 'cerez_politikasi') return false;
    if (roller.length > 0) {
      return (
        roller.includes('kurye') ||
        roller.includes('tumu') ||
        konum === 'kurye_basvuru' ||
        konum === 'kurye'
      );
    }
    return (
      konum === 'kurye_basvuru' ||
      konum === 'kurye' ||
      konum === 'genel' ||
      konum === 'tumu'
    );
  }

  if (ekran === 'kayit') {
    if (tur === 'cerez_politikasi') return false;
    if (roller.length > 0) {
      return (
        roller.includes('musteri') ||
        roller.includes('tumu') ||
        konum === 'kayit'
      );
    }
    return konum === 'kayit' || konum === 'genel' || konum === 'tumu';
  }

  if (ekran === 'siparis') {
    return konum === 'siparis';
  }

  if (ekran === 'asci_basvuru') {
    if (tur === 'cerez_politikasi') return false;
    if (roller.length > 0) {
      return (
        roller.includes('ev_mutfagi') ||
        roller.includes('asci') ||
        roller.includes('tumu') ||
        konum === 'asci_basvuru'
      );
    }
    return konum === 'asci_basvuru' || konum === 'genel' || konum === 'tumu';
  }

  return false;
}

/**
 * Firestore `sozlesmeler` koleksiyonunu `onSnapshot` ile canlı dinler.
 * Sabit liste veya `localStorage` önbelleği asla kullanmaz.
 */
export function sozlesmeleriCanliDinle(
  geriCagirim: (sozlesmeler: HukukiSozlesme[]) => void,
  hataGeriCagirim?: (mesaj: string) => void
): () => void {
  eskiYerelSozlesmeOnbelleginiTemizle();

  if (!canliFirebaseAktifMi()) {
    bellektekiSozlesmeler = {};
    geriCagirim([]);
    if (hataGeriCagirim) {
      hataGeriCagirim('Canlı Firestore yapılandırması aktif değil; sözleşmeler yüklenemedi.');
    }
    return () => {};
  }

  try {
    const kolRef = collection(db, 'sozlesmeler');
    return onSnapshot(
      kolRef,
      (snap) => {
        const yeniHarita: Record<string, HukukiSozlesme> = {};
        const liste: HukukiSozlesme[] = [];

        snap.forEach((belge) => {
          const sozlesme = belgeyiSozlesmeyeDonustur(belge.data(), belge.id);
          yeniHarita[sozlesme.tur] = sozlesme;
          liste.push(sozlesme);
        });

        bellektekiSozlesmeler = yeniHarita;
        geriCagirim(sozlesmeleriSirala(liste));
      },
      (hata) => {
        const mesaj = hata instanceof Error ? hata.message : String(hata);
        if (
          mesaj.includes('permission') ||
          mesaj.includes('insufficient') ||
          (hata as any)?.code === 'permission-denied'
        ) {
          firestoreHatasiniYonet(hata, IslemTipi.LIST, 'sozlesmeler');
        }
        bellektekiSozlesmeler = {};
        geriCagirim([]);
        if (hataGeriCagirim) {
          hataGeriCagirim('Firestore sözleşmeler koleksiyonu okunamadı.');
        }
      }
    );
  } catch (hata) {
    bellektekiSozlesmeler = {};
    geriCagirim([]);
    if (hataGeriCagirim) {
      hataGeriCagirim(
        hata instanceof Error ? hata.message : 'Sözleşme dinleyicisi başlatılamadı.'
      );
    }
    return () => {};
  }
}

/**
 * Tek seferlik canlı Firestore `sozlesmeler` okuma yardımcısı.
 */
export async function firestoreSozlesmeleriGetir(): Promise<HukukiSozlesme[]> {
  eskiYerelSozlesmeOnbelleginiTemizle();
  if (!canliFirebaseAktifMi()) {
    return Object.values(bellektekiSozlesmeler);
  }

  const fbSozlesmeler = await koleksiyonGetir<Record<string, any>>('sozlesmeler');
  const yeniHarita: Record<string, HukukiSozlesme> = {};
  const liste: HukukiSozlesme[] = [];

  for (const kayit of fbSozlesmeler) {
    const sozlesme = belgeyiSozlesmeyeDonustur(kayit, String(kayit.id || kayit.tur || ''));
    if (!sozlesme.tur) continue;
    yeniHarita[sozlesme.tur] = sozlesme;
    liste.push(sozlesme);
  }

  bellektekiSozlesmeler = yeniHarita;
  return sozlesmeleriSirala(liste);
}

/**
 * Bellekteki son `onSnapshot` sözleşme haritasını döner (sabit veya localStorage yedeği yoktur).
 */
export const hukukiSozlesmeleriGetir = (): Record<string, HukukiSozlesme> => {
  return { ...bellektekiSozlesmeler };
};

export const hukukiSozlesmeleriCanliSenkronizeEt = async (): Promise<
  Record<string, HukukiSozlesme>
> => {
  await firestoreSozlesmeleriGetir();
  return { ...bellektekiSozlesmeler };
};

export const sozlesmeGuncelle = async (sozlesme: HukukiSozlesme): Promise<boolean> => {
  if (!canliFirebaseAktifMi()) return false;
  const guncelSozlesme: HukukiSozlesme = {
    ...sozlesme,
    guncellenmeTarihi: new Date().toISOString().split('T')[0],
    aktifMi: sozlesme.aktifMi !== false
  };
  return belgeKaydet('sozlesmeler', sozlesme.tur, guncelSozlesme);
};

export const yeniSozlesmeEkle = async (
  sozlesme: Omit<HukukiSozlesme, 'guncellenmeTarihi' | 'silinebilirMi'>
): Promise<boolean> => {
  if (!canliFirebaseAktifMi()) return false;
  const kod = sozlesme.tur.trim().toLowerCase().replace(/\s+/g, '_');
  const yeni: HukukiSozlesme = {
    ...sozlesme,
    tur: kod,
    guncellenmeTarihi: new Date().toISOString().split('T')[0],
    aktifMi: sozlesme.aktifMi !== false,
    silinebilirMi: true
  };
  return belgeKaydet('sozlesmeler', kod, yeni);
};

export const sozlesmeSil = async (tur: string): Promise<boolean> => {
  if (!canliFirebaseAktifMi()) return false;
  return belgeSil('sozlesmeler', tur);
};

export const hukukiLoglariGetir = (): HukukiOnayLogu[] => {
  try {
    const kayitli = localStorage.getItem(YEREL_LOGLAR_ANAHTARI);
    if (kayitli) {
      return JSON.parse(kayitli);
    }
  } catch (e) {
    console.warn('Loglar yüklenemedi:', e);
  }
  return [];
};

export const hukukiLoglariCanliGetir = async (): Promise<HukukiOnayLogu[]> => {
  if (canliFirebaseAktifMi()) {
    try {
      const fbLoglar = await koleksiyonGetir<HukukiOnayLogu>('hukuki_onay_loglari');
      if (fbLoglar && fbLoglar.length > 0) {
        fbLoglar.sort((a, b) => (b.kimlik > a.kimlik ? 1 : -1));
        localStorage.setItem(YEREL_LOGLAR_ANAHTARI, JSON.stringify(fbLoglar));
        return fbLoglar;
      }
    } catch {
      // Yoksay
    }
  }
  return hukukiLoglariGetir();
};

export const hukukiLogKaydet = (
  logVerisi: Omit<HukukiOnayLogu, 'kimlik' | 'tarihSaat' | 'ipAdresi' | 'cihazBilgisi'>
): HukukiOnayLogu => {
  const yeniLog: HukukiOnayLogu = {
    kimlik: 'log_' + Date.now().toString() + '_' + Math.random().toString(36).substring(2, 6),
    tarihSaat: new Date().toLocaleString('tr-TR'),
    ipAdresi: 'bilinmiyor',
    cihazBilgisi:
      typeof navigator !== 'undefined' ? navigator.userAgent.substring(0, 120) : 'bilinmiyor',
    ...logVerisi
  };

  try {
    const mevcut = hukukiLoglariGetir();
    mevcut.unshift(yeniLog);
    if (mevcut.length > 500) mevcut.pop();
    localStorage.setItem(YEREL_LOGLAR_ANAHTARI, JSON.stringify(mevcut));

    if (canliFirebaseAktifMi()) {
      belgeKaydet('hukuki_onay_loglari', yeniLog.kimlik, yeniLog).catch(() => {});
    }
  } catch (e) {
    console.error('Hukuki log yazılamadı:', e);
  }

  return yeniLog;
};

export const cerezTercihleriniGetir = (): CerezTercihleri | null => {
  try {
    const kayitli = localStorage.getItem(YEREL_CEREZ_ANAHTARI);
    if (kayitli) {
      return JSON.parse(kayitli);
    }
  } catch (e) {
    console.warn('Çerez tercihleri okunamadı:', e);
  }
  return null;
};

export const cerezTercihleriniKaydet = (tercihler: CerezTercihleri): void => {
  try {
    localStorage.setItem(YEREL_CEREZ_ANAHTARI, JSON.stringify(tercihler));
    hukukiLogKaydet({
      sozlesmeTuru: 'cerez_politikasi',
      sozlesmeVersiyonu: '1.0.0',
      islemTuru: 'cerez_onayi',
      onaylandiMi: tercihler.onaylandi
    });
  } catch (e) {
    console.error('Çerez tercihleri kaydedilemedi:', e);
  }
};
