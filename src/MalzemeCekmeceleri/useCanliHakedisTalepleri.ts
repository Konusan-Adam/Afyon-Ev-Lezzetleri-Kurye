import { useState, useEffect } from 'react';
import { HakedisCekimTalebi } from '@/src/veritabani/GercekVeriYardimcisi';
import { 
  koleksiyonuCanliDinle, 
  koleksiyonGetir, 
  belgeKaydet,
  belgeSil
} from '@/src/veritabani/FirebaseKoleksiyonServisi';
import { patronBildirimiEkle } from './PatronBildirimServisi';
import { hukukiDelilDamgala } from './HukukVeSozlesmeler/hukukiDelilServisi';

export const BASLANGIC_HAKEDIS_TALEPLERI: HakedisCekimTalebi[] = [];

export function useCanliHakedisTalepleri() {
  const [talepler, setTalepler] = useState<HakedisCekimTalebi[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);

  useEffect(() => {
    let aktif = true;

    const abonelikDurdur = koleksiyonuCanliDinle<HakedisCekimTalebi>('hakedis_talepleri', (guncel) => {
      if (!aktif) return;
      const gercekTalepler = (guncel || []).filter(t => t.id !== 'hak-1' && t.id !== 'hak-2');
      setTalepler(gercekTalepler);
      setYukleniyor(false);
    });

    koleksiyonGetir<HakedisCekimTalebi>('hakedis_talepleri').then(async (mevcut) => {
      if (!aktif) return;
      // Eski statik test kayıtları (hak-1, hak-2) varsa temizle
      if (mevcut && mevcut.some(t => t.id === 'hak-1' || t.id === 'hak-2')) {
        belgeSil('hakedis_talepleri', 'hak-1').catch(() => {});
        belgeSil('hakedis_talepleri', 'hak-2').catch(() => {});
      }
      const gercekTalepler = (mevcut || []).filter(t => t.id !== 'hak-1' && t.id !== 'hak-2');
      setTalepler(gercekTalepler);
      setYukleniyor(false);
    }).catch(() => {
      if (aktif) setYukleniyor(false);
    });

    return () => {
      aktif = false;
      abonelikDurdur();
    };
  }, []);

  const talepDurumGuncelle = async (talepId: string, yeniDurum: 'odendi' | 'reddedildi' | 'beklemede', not?: string): Promise<boolean> => {
    const guncel = talepler.find(t => t.id === talepId);
    if (!guncel) return false;

    const paket = {
      ...guncel,
      durum: yeniDurum,
      odeme_tarihi: yeniDurum === 'odendi' ? new Date().toLocaleString('tr-TR') : guncel.odeme_tarihi,
      red_gerekcesi: yeniDurum === 'reddedildi' ? not : undefined
    };

    setTalepler(onceki => onceki.map(t => t.id === talepId ? paket : t));

    try {
      await belgeKaydet('hakedis_talepleri', talepId, paket);
      return true;
    } catch (err) {
      console.warn('Hakediş durum güncelleme hatası:', err);
      return false;
    }
  };

  const yeniTalepOlustur = async (yeni: HakedisCekimTalebi): Promise<boolean> => {
    setTalepler(onceki => [yeni, ...onceki]);
    try {
      await belgeKaydet('hakedis_talepleri', yeni.id, yeni);
      patronBildirimiEkle(
        'hakedis_talebi',
        'Yeni Hakediş Çekim Talebi 💰',
        `${yeni.mutfak_adi || 'Mutfak / Kurye'} tarafından ${yeni.tutar} ₺ hakediş çekim talebi iletildi.`,
        yeni.id
      );
      hukukiDelilDamgala({
        sozlesmeTuru: 'kurye_hakedis_odeme_talebi',
        sozlesmeVersiyonu: '1.0.0',
        islemTuru: 'hakedis',
        onaylandiMi: true,
        ilgiliKayitId: yeni.id,
        kullaniciKimlik: yeni.kurye_id || yeni.mutfak_id || '',
        kullaniciAdSoyad: yeni.kurye_adi || yeni.mutfak_adi || '',
        ekDetay: {
          tutar: Number(yeni.tutar ?? 0),
          rolTipi: yeni.rol_tipi || 'kurye',
          bankaAdi: yeni.banka_adi || '',
          ibanSon4: String(yeni.iban || '').slice(-4)
        }
      }).catch((err) => {
        console.warn('Hakediş talebi hukuki damga uyarısı:', err);
      });
      return true;
    } catch (err) {
      console.warn('Yeni hakediş talebi kaydetme hatası:', err);
      return false;
    }
  };

  return {
    talepler,
    yukleniyor,
    talepDurumGuncelle,
    yeniTalepOlustur
  };
}
