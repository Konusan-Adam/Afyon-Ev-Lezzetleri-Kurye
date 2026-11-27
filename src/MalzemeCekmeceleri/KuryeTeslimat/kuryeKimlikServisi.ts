import { Kullanici } from '@/src/veritabani/VeriTipleri';
import { canliFirebaseAktifMi } from '@/src/veritabani/FirebaseIstemcisi';
import { belgeKaydet, koleksiyonGetir } from '@/src/veritabani/FirebaseKoleksiyonServisi';
import { telefonGecerliMi } from '@/src/MalzemeCekmeceleri/Dogrulama/telefonDogrulayici';
import { patronBildirimiEkle } from '@/src/MalzemeCekmeceleri/PatronBildirimServisi';
import { kuryeKayitSozlesmeleriniDamgala } from '@/src/MalzemeCekmeceleri/HukukVeSozlesmeler/hukukiDelilServisi';
import {
  firestoreSozlesmeleriGetir,
  sozlesmeEkranUygunMu
} from '@/src/MalzemeCekmeceleri/HukukVeSozlesmeler/hukukDeposu';
import type { HukukiSozlesme } from '@/src/MalzemeCekmeceleri/HukukVeSozlesmeler/tipler';

export const KURYE_GUVENLIK_SORULARI = [
  'İlk motorunuzun veya aracınızın markası nedir?',
  'Doğduğunuz ilçe veya mahalle adı nedir?',
  'İlkokul öğretmeninizin adı nedir?',
  'Annenizin kızlık soyadının ilk iki harfi veya adı nedir?',
  'En sevdiğiniz Afyon yöresel yemeği nedir?'
] as const;

export const KURYE_ARAC_TIPLERI = [
  'Motosiklet',
  'Bisiklet',
  'Otomobil',
  'Yaya'
] as const;

export const AFYON_ILCELERI = [
  'Merkez',
  'Sandıklı',
  'Dinar',
  'Bolvadin',
  'Emirdağ',
  'Şuhut',
  'Çay',
  'İscehisar',
  'Sultandağı',
  'Sinanpaşa',
  'Dazkırı',
  'Başmakçı',
  'İhsaniye',
  'Çobanlar',
  'Hocalar',
  'Bayat',
  'Evciler',
  'Kızılören'
] as const;

const YEREL_KURYE_DEPOSU = 'afyon_yerel_kurye_hesaplari_v1';
const SIFIRLAMA_HIZ_ANAHTARI = 'afyon_kurye_sifre_sifirlama_sinir_v1';
const MAKS_DENEME = 5;
const PENCERE_SURESI_MS = 5 * 60 * 1000;

export interface KuryeKayitBilgisi {
  ad_soyad: string;
  telefon: string;
  sifre: string;
  guvenlik_sorusu: string;
  guvenlik_cevabi: string;
  ilce: string;
  arac_tipi: string;
  plaka?: string;
  ehliyet_durumu: string;
  belge_beyani: string;
  onaylanan_sozlesmeler: HukukiSozlesme[];
}

export interface KuryeKimlikSonucu {
  basarili: boolean;
  mesaj: string;
  kullanici?: Kullanici;
}

interface HizSiniriKaydi {
  denemeler: number[];
}

const bellekHizSiniri = new Map<string, HizSiniriKaydi>();

function telefonTemizle(tel: string): string {
  const rakamlar = String(tel || '').replace(/\D/g, '');
  if (rakamlar.startsWith('90') && rakamlar.length === 12) {
    return rakamlar.substring(2);
  }
  if (rakamlar.startsWith('0') && rakamlar.length === 11) {
    return rakamlar.substring(1);
  }
  return rakamlar;
}

function duzgunTelefonFormatla(standart10: string): string {
  return standart10.startsWith('0') ? standart10 : `0${standart10}`;
}

function rastgeleTuzUret(): string {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const baytlar = new Uint8Array(16);
    crypto.getRandomValues(baytlar);
    return Array.from(baytlar)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return `${Date.now().toString(16)}${Math.random().toString(16).slice(2, 10)}`;
}

async function tuzluSha256(metin: string, tuz: string): Promise<string> {
  const girdi = `${tuz}:${metin}`;
  if (typeof crypto !== 'undefined' && crypto.subtle && typeof TextEncoder !== 'undefined') {
    const baytlar = new TextEncoder().encode(girdi);
    const ozet = await crypto.subtle.digest('SHA-256', baytlar);
    return Array.from(new Uint8Array(ozet))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Yalnızca Web Crypto olmayan çok nadir ortamlarda deterministik özet yedeklemesi
  let h1 = 0x811c9dc5;
  for (let i = 0; i < girdi.length; i++) {
    h1 ^= girdi.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193);
  }
  return (h1 >>> 0).toString(16).padStart(8, '0');
}

function guvenlikCevabiniNormalizeEt(cevap: string): string {
  return String(cevap || '').trim().toLocaleLowerCase('tr-TR');
}

function yerelKuryeleriOku(): any[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const ham = localStorage.getItem(YEREL_KURYE_DEPOSU);
    const parsed = ham ? JSON.parse(ham) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function yerelKuryeKaydet(kayit: any): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const mevcut = yerelKuryeleriOku().filter(
      (k) => telefonTemizle(k.telefon || '') !== telefonTemizle(kayit.telefon || '')
    );
    mevcut.unshift(kayit);
    localStorage.setItem(YEREL_KURYE_DEPOSU, JSON.stringify(mevcut));
  } catch {
    // Depolama doluysa sessiz geç
  }
}

function hizSiniriHaritasiOku(): Record<string, HizSiniriKaydi> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const ham = localStorage.getItem(SIFIRLAMA_HIZ_ANAHTARI);
    const parsed = ham ? JSON.parse(ham) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function hizSiniriHaritasiYaz(harita: Record<string, HizSiniriKaydi>): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(SIFIRLAMA_HIZ_ANAHTARI, JSON.stringify(harita));
  } catch {
    // Yoksay
  }
}

function sifirlamaLimitiKontrolEt(standartTel: string): { izinli: boolean; kalanSaniye: number } {
  const simdi = Date.now();
  const harita = hizSiniriHaritasiOku();
  const bellekKayit = bellekHizSiniri.get(standartTel)?.denemeler || [];
  const depoKayit = harita[standartTel]?.denemeler || [];
  const birlesik = Array.from(new Set([...bellekKayit, ...depoKayit]))
    .filter((z) => simdi - z < PENCERE_SURESI_MS)
    .sort((a, b) => a - b);

  if (birlesik.length >= MAKS_DENEME) {
    const enEski = birlesik[0];
    const kalanMs = PENCERE_SURESI_MS - (simdi - enEski);
    return { izinli: false, kalanSaniye: Math.max(1, Math.ceil(kalanMs / 1000)) };
  }
  return { izinli: true, kalanSaniye: 0 };
}

function basarisizSifirlamaDenemesiEkle(standartTel: string): number {
  const simdi = Date.now();
  const harita = hizSiniriHaritasiOku();
  const bellekKayit = bellekHizSiniri.get(standartTel)?.denemeler || [];
  const depoKayit = harita[standartTel]?.denemeler || [];
  const guncel = Array.from(new Set([...bellekKayit, ...depoKayit, simdi]))
    .filter((z) => simdi - z < PENCERE_SURESI_MS)
    .sort((a, b) => a - b);

  bellekHizSiniri.set(standartTel, { denemeler: guncel });
  harita[standartTel] = { denemeler: guncel };
  hizSiniriHaritasiYaz(harita);

  return Math.max(0, MAKS_DENEME - guncel.length);
}

function sifirlamaLimitiniTemizle(standartTel: string): void {
  bellekHizSiniri.delete(standartTel);
  const harita = hizSiniriHaritasiOku();
  delete harita[standartTel];
  hizSiniriHaritasiYaz(harita);
}

async function tumKullanicilardanTelefonlaBul(standartTelefon: string): Promise<any | null> {
  if (canliFirebaseAktifMi()) {
    const liste = await koleksiyonGetir<any>('kullanicilar');
    const eslesen = (liste || []).find((k) => telefonTemizle(k.telefon || '') === standartTelefon);
    if (eslesen) return eslesen;
  }
  const yerel = yerelKuryeleriOku().find((k) => telefonTemizle(k.telefon || '') === standartTelefon);
  return yerel || null;
}

async function sifreDogrula(kullaniciKaydi: any, girilenSifre: string): Promise<boolean> {
  const temizSifre = String(girilenSifre || '').trim();
  if (!temizSifre) return false;

  if (kullaniciKaydi.sifre_hash && kullaniciKaydi.sifre_tuzu) {
    const hesaplanan = await tuzluSha256(temizSifre, String(kullaniciKaydi.sifre_tuzu));
    return hesaplanan === kullaniciKaydi.sifre_hash;
  }

  if (typeof kullaniciKaydi.sifre === 'string' && kullaniciKaydi.sifre !== '') {
    return kullaniciKaydi.sifre === temizSifre;
  }

  return false;
}

function guvenliKullaniciNesnesi(ham: any): Kullanici {
  const kopya = { ...ham };
  delete kopya.sifre;
  delete kopya.sifre_hash;
  delete kopya.sifre_tuzu;
  delete kopya.guvenlik_cevabi;
  delete kopya.guvenlik_cevap_hash;
  delete kopya.guvenlik_cevap_tuzu;
  return kopya as Kullanici;
}

/**
 * Yalnızca `rol === 'kurye'` hesaplarının giriş yapmasına izin verir.
 * Müşteri, mutfak, şube veya yönetici hesaplarını kesin olarak reddeder; master/test şifre içermez.
 */
export async function kuryeGirisYap(
  telefon: string,
  sifre: string
): Promise<KuryeKimlikSonucu> {
  const telKontrol = telefonGecerliMi(telefon);
  if (!telKontrol.gecerli) {
    return { basarili: false, mesaj: telKontrol.hata || 'Geçerli bir cep telefonu giriniz.' };
  }

  const temizSifre = String(sifre || '').trim();
  if (!temizSifre) {
    return { basarili: false, mesaj: 'Lütfen şifrenizi giriniz.' };
  }

  const standartTelefon = telefonTemizle(telefon);
  const kayit = await tumKullanicardanBul(standartTelefon);

  if (!kayit) {
    return {
      basarili: false,
      mesaj: 'Bu telefon numarası ile kayıtlı kurye hesabı bulunamadı.'
    };
  }

  if (kayit.rol !== 'kurye') {
    return {
      basarili: false,
      mesaj: 'Bu panel yalnızca yetkili kurye personeli içindir.'
    };
  }

  if (kayit.askida_mi === true || kayit.onay_durumu === 'askida') {
    return {
      basarili: false,
      mesaj: 'Kurye hesabınız askıya alınmıştır. Lütfen genel merkez ile iletişime geçiniz.'
    };
  }

  if (kayit.onay_durumu === 'reddedildi') {
    return {
      basarili: false,
      mesaj: 'Kurye başvurunuz onaylanmamıştır.'
    };
  }

  const sifreGecerli = await sifreDogrula(kayit, temizSifre);
  if (!sifreGecerli) {
    return {
      basarili: false,
      mesaj: 'Telefon numarası veya şifre hatalı.'
    };
  }

  return {
    basarili: true,
    mesaj: 'Giriş başarılı.',
    kullanici: guvenliKullaniciNesnesi(kayit)
  };
}

async function tumKullanicardanBul(standartTelefon: string): Promise<any | null> {
  return tumKullanicilardanTelefonlaBul(standartTelefon);
}

/**
 * Rol izolasyonlu kendi kendine kurye kayıt akışı.
 * `onayli_mi: false`, `onay_durumu: 'beklemede'`, `rol: 'kurye'` olarak kaydeder,
 * Patron bildirimine başvuruyu düşürür ve 3 zorunlu sözleşmeyi RFC 3161 + SHA-256 ile damgalar.
 */
export async function kuryeKayitOl(girdi: KuryeKayitBilgisi): Promise<KuryeKimlikSonucu> {
  const adSoyad = String(girdi.ad_soyad || '').trim();
  if (adSoyad.length < 3) {
    return { basarili: false, mesaj: 'Lütfen adınızı ve soyadınızı eksiksiz giriniz.' };
  }

  const telKontrol = telefonGecerliMi(girdi.telefon);
  if (!telKontrol.gecerli) {
    return { basarili: false, mesaj: telKontrol.hata || 'Geçerli bir Türkiye cep telefonu giriniz.' };
  }

  const temizSifre = String(girdi.sifre || '').trim();
  if (temizSifre.length < 6) {
    return { basarili: false, mesaj: 'Şifreniz en az 6 karakter olmalıdır.' };
  }

  const guvenlikSorusu = String(girdi.guvenlik_sorusu || '').trim();
  const guvenlikCevabi = guvenlikCevabiniNormalizeEt(girdi.guvenlik_cevabi);
  if (!guvenlikSorusu || guvenlikCevabi.length < 2) {
    return { basarili: false, mesaj: 'Lütfen şifre sıfırlama için güvenlik sorusu ve cevabını giriniz.' };
  }

  const aracTipi = String(girdi.arac_tipi || '').trim();
  if (!aracTipi) {
    return { basarili: false, mesaj: 'Lütfen araç tipinizi seçiniz.' };
  }

  const aracPlakaGerekli = aracTipi === 'Motosiklet' || aracTipi === 'Otomobil';
  const plaka = String(girdi.plaka || '').trim().toUpperCase();
  if (aracPlakaGerekli && plaka.length < 5) {
    return { basarili: false, mesaj: `${aracTipi} seçimi için araç plakası zorunludur.` };
  }

  if (!girdi.ehliyet_durumu || !girdi.belge_beyani) {
    return { basarili: false, mesaj: 'Lütfen ehliyet ve adli sicil / belge beyanını seçiniz.' };
  }

  const onaylananListe = Array.isArray(girdi.onaylanan_sozlesmeler)
    ? girdi.onaylanan_sozlesmeler
    : [];
  const onaylananTurler = new Set(onaylananListe.map((s) => s.tur));

  const gecerliSozlesmeler = (await firestoreSozlesmeleriGetir()).filter((s) =>
    sozlesmeEkranUygunMu(s, 'kurye_basvuru')
  );
  const eksikZorunlu = gecerliSozlesmeler.filter(
    (s) => s.zorunluMu !== false && !onaylananTurler.has(s.tur)
  );

  if (eksikZorunlu.length > 0) {
    return {
      basarili: false,
      mesaj: `Kayıt işlemini tamamlamak için tüm zorunlu sözleşmeleri (${eksikZorunlu
        .map((s) => s.kisaBaslik || s.baslik)
        .join(', ')}) açıp okuyarak onaylamalısınız.`
    };
  }

  const standartTelefon = telefonTemizle(girdi.telefon);
  const mevcut = await tumKullanicilardanTelefonlaBul(standartTelefon);
  if (mevcut) {
    return {
      basarili: false,
      mesaj:
        mevcut.rol === 'kurye'
          ? 'Bu cep telefonu numarasıyla zaten bir kurye kaydı mevcut.'
          : 'Bu telefon numarası sistemde farklı bir kullanıcı hesabına kayıtlı.'
    };
  }

  const duzgunTelefon = duzgunTelefonFormatla(standartTelefon);
  const kimlikId = `tel_${duzgunTelefon}`;
  const simdiIso = new Date().toISOString();

  const sifreTuzu = rastgeleTuzUret();
  const sifreHash = await tuzluSha256(temizSifre, sifreTuzu);
  const cevapTuzu = rastgeleTuzUret();
  const cevapHash = await tuzluSha256(guvenlikCevabi, cevapTuzu);

  const kullaniciBelgesi = {
    id: kimlikId,
    kimlik: kimlikId,
    ad_soyad: adSoyad,
    telefon: duzgunTelefon,
    eposta: '',
    sifre_hash: sifreHash,
    sifre_tuzu: sifreTuzu,
    guvenlik_sorusu: guvenlikSorusu,
    guvenlik_cevap_hash: cevapHash,
    guvenlik_cevap_tuzu: cevapTuzu,
    rol: 'kurye',
    isletme_adi: '',
    arac_tipi: aracTipi,
    plaka: aracPlakaGerekli ? plaka : 'Yaya / Plakasız',
    ilce: girdi.ilce || 'Merkez',
    ehliyet_durumu: girdi.ehliyet_durumu,
    belge_beyani: girdi.belge_beyani,
    onayli_mi: false,
    onay_durumu: 'beklemede',
    askida_mi: false,
    olusturma_tarihi: simdiIso
  };

  yerelKuryeKaydet(kullaniciBelgesi);

  if (canliFirebaseAktifMi()) {
    try {
      await belgeKaydet('kullanicilar', kimlikId, kullaniciBelgesi);
    } catch (hata) {
      console.warn('Kurye kullanıcı kaydı Firestore yazma uyarısı:', hata);
    }

    try {
      await belgeKaydet('kuryeler', kimlikId, {
        id: kimlikId,
        kimlik: kimlikId,
        ad_soyad: adSoyad,
        telefon: duzgunTelefon,
        arac_tipi: aracTipi,
        plaka: kullaniciBelgesi.plaka,
        ilce: kullaniciBelgesi.ilce,
        ehliyet_durumu: girdi.ehliyet_durumu,
        belge_beyani: girdi.belge_beyani,
        onayli_mi: false,
        onay_durumu: 'beklemede',
        durum: 'molada',
        askida_mi: false,
        tamamlanan_siparis: 0,
        toplam_teslimat: 0,
        bakiye: 0,
        olusturma_tarihi: simdiIso
      });
    } catch {
      // Kuryeler koleksiyonunda yalnızca yönetici yazma yetkisi varsa kullanıcı kaydı yeterli kalır
    }
  }

  patronBildirimiEkle(
    'yeni_kurye',
    'Yeni Kurye Başvurusu 🛵',
    `${adSoyad} (${duzgunTelefon} • ${kullaniciBelgesi.ilce} • ${aracTipi}) kurye başvurusu yaptı. Onay bekliyor.`,
    kimlikId
  );

  await kuryeKayitSozlesmeleriniDamgala({
    kullaniciKimlik: kimlikId,
    kullaniciTelefon: duzgunTelefon,
    kullaniciAdSoyad: adSoyad,
    sozlesmeler: onaylananListe,
    ekDetay: {
      aracTipi,
      plaka: kullaniciBelgesi.plaka,
      ilce: kullaniciBelgesi.ilce,
      ehliyetDurumu: girdi.ehliyet_durumu,
      belgeBeyani: girdi.belge_beyani
    }
  }).catch((err) => {
    console.warn('Kurye kayıt hukuki damgalama uyarısı:', err);
  });

  return {
    basarili: true,
    mesaj: 'Kurye başvurunuz alındı! Sözleşmeleriniz zaman damgası ile mühürlendi; patron onayı bekleniyor.',
    kullanici: guvenliKullaniciNesnesi(kullaniciBelgesi)
  };
}

/**
 * Şifre sıfırlama için yalnızca kurye rolündeki hesabın güvenlik sorusunu döner.
 */
export async function kuryeGuvenlikSorusuGetir(telefon: string): Promise<{
  basarili: boolean;
  soru?: string;
  mesaj?: string;
}> {
  const telKontrol = telefonGecerliMi(telefon);
  if (!telKontrol.gecerli) {
    return { basarili: false, mesaj: telKontrol.hata || 'Geçerli bir cep telefonu giriniz.' };
  }

  const standartTel = telefonTemizle(telefon);
  const sinir = sifirlamaLimitiKontrolEt(standartTel);
  if (!sinir.izinli) {
    const dk = Math.ceil(sinir.kalanSaniye / 60);
    return {
      basarili: false,
      mesaj: `Çok fazla hatalı deneme yapıldı. Güvenlik nedeniyle yaklaşık ${dk} dakika (${sinir.kalanSaniye} sn) sonra tekrar deneyiniz.`
    };
  }

  const kayit = await tumKullanicilardanTelefonlaBul(standartTel);
  if (!kayit) {
    return { basarili: false, mesaj: 'Bu cep telefonu numarası ile kayıtlı kurye bulunamadı.' };
  }

  if (kayit.rol !== 'kurye') {
    return { basarili: false, mesaj: 'Bu panel yalnızca yetkili kurye personeli içindir.' };
  }

  if (!kayit.guvenlik_sorusu) {
    return {
      basarili: false,
      mesaj: 'Bu kurye hesabında güvenlik sorusu tanımlı değil. Lütfen yönetici ile iletişime geçiniz.'
    };
  }

  return {
    basarili: true,
    soru: String(kayit.guvenlik_sorusu)
  };
}

/**
 * Güvenlik sorusu doğrulamalı kurye şifre sıfırlama (5 deneme / 5 dakika hız sınırlı).
 */
export async function kuryeSifreSifirla(param: {
  telefon: string;
  guvenlikCevabi: string;
  yeniSifre: string;
}): Promise<{ basarili: boolean; mesaj: string }> {
  const telKontrol = telefonGecerliMi(param.telefon);
  if (!telKontrol.gecerli) {
    return { basarili: false, mesaj: telKontrol.hata || 'Geçerli bir cep telefonu giriniz.' };
  }

  const yeniSifre = String(param.yeniSifre || '').trim();
  if (yeniSifre.length < 6) {
    return { basarili: false, mesaj: 'Yeni şifreniz en az 6 karakter olmalıdır.' };
  }

  const standartTel = telefonTemizle(param.telefon);
  const sinir = sifirlamaLimitiKontrolEt(standartTel);
  if (!sinir.izinli) {
    const dk = Math.ceil(sinir.kalanSaniye / 60);
    return {
      basarili: false,
      mesaj: `5 başarısız deneme sınırına ulaşıldı. Lütfen ${dk} dakika (${sinir.kalanSaniye} sn) bekleyiniz.`
    };
  }

  const kayit = await tumKullanicilardanTelefonlaBul(standartTel);
  if (!kayit) {
    return { basarili: false, mesaj: 'Kurye hesabı bulunamadı.' };
  }

  if (kayit.rol !== 'kurye') {
    return { basarili: false, mesaj: 'Bu panel yalnızca yetkili kurye personeli içindir.' };
  }

  const normalizeCevap = guvenlikCevabiniNormalizeEt(param.guvenlikCevabi);
  let cevapDogruMu = false;

  if (kayit.guvenlik_cevap_hash && kayit.guvenlik_cevap_tuzu) {
    const hesaplanan = await tuzluSha256(normalizeCevap, String(kayit.guvenlik_cevap_tuzu));
    cevapDogruMu = hesaplanan === kayit.guvenlik_cevap_hash;
  } else if (typeof kayit.guvenlik_cevabi === 'string' && kayit.guvenlik_cevabi.trim() !== '') {
    cevapDogruMu = guvenlikCevabiniNormalizeEt(kayit.guvenlik_cevabi) === normalizeCevap;
  }

  if (!cevapDogruMu) {
    const kalanHak = basarisizSifirlamaDenemesiEkle(standartTel);
    if (kalanHak <= 0) {
      return {
        basarili: false,
        mesaj: 'Güvenlik cevabı hatalı. 5 deneme hakkınız doldu; güvenlik için 5 dakika bekleyiniz.'
      };
    }
    return {
      basarili: false,
      mesaj: `Güvenlik cevabı hatalı. Kalan deneme hakkı: ${kalanHak}`
    };
  }

  sifirlamaLimitiniTemizle(standartTel);

  const yeniTuz = rastgeleTuzUret();
  const yeniHash = await tuzluSha256(yeniSifre, yeniTuz);
  const guncelKayit = {
    ...kayit,
    sifre_hash: yeniHash,
    sifre_tuzu: yeniTuz,
    sifre: ''
  };

  yerelKuryeKaydet(guncelKayit);

  if (canliFirebaseAktifMi()) {
    const belgeId = kayit.id || kayit.kimlik || `tel_${duzgunTelefonFormatla(standartTel)}`;
    try {
      await belgeKaydet('kullanicilar', belgeId, {
        sifre_hash: yeniHash,
        sifre_tuzu: yeniTuz,
        sifre: ''
      });
    } catch (hata) {
      console.warn('Kurye şifre güncelleme Firestore hatası:', hata);
    }
  }

  return {
    basarili: true,
    mesaj: 'Kurye şifreniz başarıyla güncellendi. Yeni şifrenizle giriş yapabilirsiniz.'
  };
}
