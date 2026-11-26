import { androidZilAyarla } from '@/src/MalzemeCekmeceleri/AndroidKopru/AndroidKopruServisi';

export interface HazirZilSecenegi {
  kimlik: string;
  ad: string;
  aciklama: string;
  dosyaYolu: string;
}

export interface KuryeZilAyari {
  seciliKimlik: string;
  sesSeviyesi: number;
  ozelSesAdi: string;
  ozelSesVeriUrl: string;
}

export const HAZIR_ZIL_SESLERI: HazirZilSecenegi[] = [
  {
    kimlik: 'korna_klasik',
    ad: 'Klasik Kurye Kornası',
    aciklama: 'Çift tonlu dikkat çekici kurye ikaz kornası',
    dosyaYolu: './sesler/zil_korna_klasik.wav'
  },
  {
    kimlik: 'acil_siren',
    ad: 'Acil Paket Sireni',
    aciklama: 'Yüksek gürültülü trafik ve kask içi için güçlü siren',
    dosyaYolu: './sesler/zil_acil_siren.wav'
  },
  {
    kimlik: 'yumusak_melodi',
    ad: 'Sıcak Ev Melodisi',
    aciklama: 'Dört notalı akıcı bildirim melodisi',
    dosyaYolu: './sesler/zil_yumusak_melodi.wav'
  },
  {
    kimlik: 'tek_uyari',
    ad: 'Çift Çınlama İkazı',
    aciklama: 'Net ve kısa çift tonlu zil sesi',
    dosyaYolu: './sesler/zil_tek_uyari.wav'
  }
];

const DEPOLAMA_ANAHTARI = 'afyon_kurye_zil_ayari_v1';

const VARSAYILAN_AYAR: KuryeZilAyari = {
  seciliKimlik: 'korna_klasik',
  sesSeviyesi: 0.9,
  ozelSesAdi: '',
  ozelSesVeriUrl: ''
};

let aktifSesOynatici: HTMLAudioElement | null = null;

export function zilAyariniYukle(): KuryeZilAyari {
  try {
    if (typeof localStorage === 'undefined') return VARSAYILAN_AYAR;
    const ham = localStorage.getItem(DEPOLAMA_ANAHTARI);
    if (!ham) return VARSAYILAN_AYAR;
    const parsed = JSON.parse(ham);
    const sesSeviyesi = Math.max(0.2, Math.min(1.0, Number(parsed.sesSeviyesi) || 0.9));
    return {
      seciliKimlik: String(parsed.seciliKimlik || 'korna_klasik'),
      sesSeviyesi,
      ozelSesAdi: String(parsed.ozelSesAdi || ''),
      ozelSesVeriUrl: String(parsed.ozelSesVeriUrl || '')
    };
  } catch {
    return VARSAYILAN_AYAR;
  }
}

export function zilAyariniKaydetVeSenkronizeEt(yeniAyar: KuryeZilAyari): KuryeZilAyari {
  const guvenliAyar: KuryeZilAyari = {
    seciliKimlik: yeniAyar.seciliKimlik || 'korna_klasik',
    sesSeviyesi: Math.max(0.2, Math.min(1.0, Number(yeniAyar.sesSeviyesi) || 0.9)),
    ozelSesAdi: yeniAyar.ozelSesAdi || '',
    ozelSesVeriUrl: yeniAyar.ozelSesVeriUrl || ''
  };

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(DEPOLAMA_ANAHTARI, JSON.stringify(guvenliAyar));
    }
  } catch {
    // Depolama kotası aşılırsa yalnızca bellek ve native köprüyü güncelle
  }

  androidZilAyarla(
    guvenliAyar.seciliKimlik,
    guvenliAyar.sesSeviyesi,
    guvenliAyar.seciliKimlik === 'ozel' ? guvenliAyar.ozelSesVeriUrl : ''
  );

  return guvenliAyar;
}

export function webZilSustur(): void {
  if (aktifSesOynatici) {
    try {
      aktifSesOynatici.pause();
      aktifSesOynatici.currentTime = 0;
    } catch {
      // Yoksay
    }
    aktifSesOynatici = null;
  }
}

export function webZilSesiCal(ozelAyar?: KuryeZilAyari): boolean {
  if (typeof window === 'undefined') return false;
  const ayar = ozelAyar || zilAyariniYukle();

  webZilSustur();

  let kaynakUrl = '';
  if (ayar.seciliKimlik === 'ozel' && ayar.ozelSesVeriUrl) {
    kaynakUrl = ayar.ozelSesVeriUrl;
  } else {
    const hazir = HAZIR_ZIL_SESLERI.find((z) => z.kimlik === ayar.seciliKimlik) || HAZIR_ZIL_SESLERI[0];
    kaynakUrl = hazir.dosyaYolu;
  }

  try {
    const ses = new Audio(kaynakUrl);
    ses.volume = Math.max(0.2, Math.min(1.0, ayar.sesSeviyesi));
    aktifSesOynatici = ses;
    ses.play().catch(() => {});
    return true;
  } catch {
    return false;
  }
}
