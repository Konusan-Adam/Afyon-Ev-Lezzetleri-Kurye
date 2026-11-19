import { canliFirebaseAktifMi } from '@/src/veritabani/FirebaseIstemcisi';
import { belgeKaydet, koleksiyonGetir, koleksiyonuCanliDinle } from '@/src/veritabani/FirebaseKoleksiyonServisi';

export interface CokluMenuKaydi {
  id: string;
  baslik?: string;
  mutfak_id?: string;
  mutfak_adi?: string;
  onay_durumu?: 'beklemede' | 'onaylandi' | 'reddedildi' | string;
  onayli_mi?: boolean;
  fiyat?: number;
  urunler?: any[];
  guncellenme_tarihi?: string;
  [key: string]: any;
}

export async function cokluMenuDurumGuncelle(
  menuId: string,
  onayDurumu: 'onaylandi' | 'reddedildi' | 'beklemede'
): Promise<boolean> {
  const onayliMi = onayDurumu === 'onaylandi';

  if (canliFirebaseAktifMi()) {
    try {
      const basarili = await belgeKaydet('coklu_menuler', menuId, {
        onay_durumu: onayDurumu,
        onayli_mi: onayliMi,
        guncellenme_tarihi: new Date().toISOString()
      });
      return basarili;
    } catch (err) {
      console.warn('Çoklu menü durum güncelleme hatası:', err);
    }
  }
  return false;
}

export async function cokluMenuleriGetir(): Promise<CokluMenuKaydi[]> {
  if (canliFirebaseAktifMi()) {
    try {
      const list = await koleksiyonGetir<CokluMenuKaydi>('coklu_menuler');
      return list || [];
    } catch (err) {
      console.warn('Çoklu menüler çekilirken hata:', err);
    }
  }
  return [];
}

export async function bekleyenCokluMenuleriGetir(): Promise<CokluMenuKaydi[]> {
  const tum = await cokluMenuleriGetir();
  return tum.filter((m) => m.onay_durumu === 'beklemede' || m.onayli_mi === false);
}

export function cokluMenuleriCanliDinle(
  geriCagirim: (menuler: CokluMenuKaydi[]) => void
): () => void {
  if (!canliFirebaseAktifMi()) return () => {};
  return koleksiyonuCanliDinle<CokluMenuKaydi>('coklu_menuler', (veriler) => {
    geriCagirim(veriler || []);
  });
}
