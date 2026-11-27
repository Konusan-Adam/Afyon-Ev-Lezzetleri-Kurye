/**
 * Afyon Ev Lezzetleri — Hukuki Sözleşmeler, Zaman Damgası ve Çerez Yönetimi Tipleri
 */

export type SozlesmeTuru =
  | 'mesafeli_satis'
  | 'on_bilgilendirme'
  | 'kvkk_aydinlatma'
  | 'kullanici_sozlesmesi'
  | 'cerez_politikasi'
  | 'iptal_iade_kosullari'
  | 'kurye_kayit_sozlesmesi'
  | 'kurye_ehliyet_arac_beyani'
  | 'kurye_paket_teslim_alma'
  | 'teslimat_pin_qr_onayi'
  | 'kurye_hakedis_odeme_talebi'
  | string;

export type SozlesmeKonumu =
  | 'asci_basvuru'
  | 'kurye_basvuru'
  | 'kurye'
  | 'kayit'
  | 'siparis'
  | 'genel'
  | 'tumu';

export type HukukiIslemTuru =
  | 'kayit'
  | 'siparis'
  | 'cerez_onayi'
  | 'ozel_onay'
  | 'teslimat'
  | 'iptal'
  | 'hakedis';

export type DamgaDurumu = 'rfc3161_onayli' | 'sunucu_muhurlu' | 'yerel_ozet';

export interface HukukiSozlesme {
  tur: SozlesmeTuru;
  baslik: string;
  kisaBaslik: string;
  versiyon: string;
  guncellenmeTarihi: string;
  icerik: string;
  zorunluMu: boolean;
  aktifMi?: boolean;
  konum?: SozlesmeKonumu;
  hedefRoller?: string[];
  silinebilirMi?: boolean;
}

export interface HukukiOnayLogu {
  kimlik: string;
  sozlesmeTuru: string;
  sozlesmeVersiyonu: string;
  islemTuru: HukukiIslemTuru;
  tarihSaat: string;
  ipAdresi: string;
  cihazBilgisi: string;
  onaylandiMi: boolean;
  sunucuKayitZamani?: unknown;
  sunucuUtc?: string;
  ozetHash?: string;
  sozlesmeMetinHash?: string;
  tsaSaglayici?: string;
  tsaTokenBase64?: string;
  damgaDurumu?: DamgaDurumu;
  sunucuImzasi?: string;
  ilgiliKayitId?: string;
  kullaniciKimlik?: string;
  kullaniciTelefon?: string;
  kullaniciAdSoyad?: string;
  ekDetay?: Record<string, unknown>;
}

export interface CerezTercihleri {
  zorunlu: boolean;
  analitik: boolean;
  pazarlama: boolean;
  onaylandi: boolean;
  tarih: string;
}
