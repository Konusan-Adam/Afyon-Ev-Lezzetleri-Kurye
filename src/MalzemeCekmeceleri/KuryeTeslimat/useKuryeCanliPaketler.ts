import { useState, useEffect, useCallback } from 'react';
import { canliFirebaseAktifMi } from '@/src/veritabani/FirebaseIstemcisi';
import { koleksiyonuCanliDinle, koleksiyonGetir } from '@/src/veritabani/FirebaseKoleksiyonServisi';
import { yerelSiparisleriGetir } from '@/src/MalzemeCekmeceleri/useMusteriSiparisleri';
import { siparisIptalEt } from '@/src/MalzemeCekmeceleri/MutfakYonetimi/siparisIptalIslemleri';
import { kuryePaketiUzerineAl, kuryePaketiTeslimAldi, kuryePinDogrulaVeTeslimEt, kuryeZamanAsimiKontrolEt } from './KuryePinServisi';

export const useKuryeCanliPaketler = (
  kuryeId: string,
  kuryeAdi: string,
  kuryeTelefon: string = ''
) => {
  const [paketler, setPaketler] = useState<any[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);

  const yenile = useCallback(async () => {
    // ⏱️ Önce 5 dakika kuralı zaman aşımı kontrolünü çalıştır
    await kuryeZamanAsimiKontrolEt();

    const harita = new Map<string, any>();

    // 1. Önce yerel hafızadaki siparişleri yükle
    const yerelListe = yerelSiparisleriGetir();
    yerelListe.forEach((s) => {
      const kod = s.siparis_kodu || s.siparisKodu || s.id;
      if (kod) harita.set(kod, s);
    });

    // 2. Canlı Firebase aktifse verileri üstüne merge et
    if (canliFirebaseAktifMi()) {
      try {
        const tum = await koleksiyonGetir<any>('siparisler');
        if (tum && Array.isArray(tum)) {
          tum.forEach((fbSip) => {
            const kod = fbSip.siparis_kodu || fbSip.siparisKodu || fbSip.id;
            if (kod) {
              const onceki = harita.get(kod) || {};
              harita.set(kod, { ...onceki, ...fbSip });
            }
          });
        }
      } catch (err) {
        console.warn('Kurye paketleri çekilirken hata:', err);
      }
    }

    setPaketler(Array.from(harita.values()));
    setYukleniyor(false);
  }, []);

  useEffect(() => {
    yenile();

    // Periyodik olarak 5 dakika kuralı kontrolü (her 30 saniyede bir)
    const zamanAsimiInterval = setInterval(() => {
      kuryeZamanAsimiKontrolEt().then(() => yenile());
    }, 30000);

    let abonelikBitir = () => {};
    if (canliFirebaseAktifMi()) {
      abonelikBitir = koleksiyonuCanliDinle<any>('siparisler', () => {
        yenile();
      });
    }

    const durumDinle = () => {
      yenile();
    };

    window.addEventListener('afyon_siparis_durum_degisti', durumDinle);
    window.addEventListener('afyon_siparis_eklendi', durumDinle);

    return () => {
      clearInterval(zamanAsimiInterval);
      abonelikBitir();
      window.removeEventListener('afyon_siparis_durum_degisti', durumDinle);
      window.removeEventListener('afyon_siparis_eklendi', durumDinle);
    };
  }, [yenile]);

  const paketiAl = async (siparisId: string, tahminiDakika: number = 15) => {
    const sonuc = await kuryePaketiUzerineAl(siparisId, kuryeId, kuryeAdi, kuryeTelefon, tahminiDakika);
    await yenile();
    return sonuc;
  };

  const paketiTeslimAldiBildir = async (siparisId: string) => {
    const sonuc = await kuryePaketiTeslimAldi(siparisId, kuryeId);
    await yenile();
    return sonuc;
  };

  const teslimEt = async (
    siparisKodu: string,
    pin: string,
    dogrulamaYontemi?: 'pin' | 'qr'
  ) => {
    const sonuc = await kuryePinDogrulaVeTeslimEt(siparisKodu, pin, dogrulamaYontemi);
    await yenile();
    return sonuc;
  };

  const paketiIptalEt = async (siparisId: string, gerekce: string, detayNot?: string) => {
    const basarili = await siparisIptalEt(siparisId, gerekce, detayNot, 'kurye', undefined, {
      kuryeId,
      kuryeAdi,
      kuryeTelefon
    });
    await yenile();
    return basarili
      ? { basarili: true, mesaj: 'Sipariş kurye tarafından iptal edildi ve zaman damgasıyla kaydedildi.' }
      : { basarili: false, mesaj: 'Sipariş iptal edilemedi.' };
  };

  // 1. Mutfakta paketlenmiş VEYA kuryenin üzerine aldığı aktif paketler
  const aktifPaketler = paketler.filter((p) => {
    const durum = (p.durum || '').toLowerCase();
    const asama = (p.asama || '').toLowerCase();

    const hazirMi = 
      durum === 'paketlendi' || 
      durum === 'yolda' || 
      asama === 'paketlendi' || 
      asama === 'kurye_geliyor' || 
      asama === 'kuryede';

    const tamamlandiMi = 
      durum === 'teslim_edildi' || 
      durum === 'iptal' || 
      asama === 'teslim_edildi' ||
      asama === 'iptal';
    
    if (!hazirMi || tamamlandiMi) return false;
    
    const sahipsiz = !p.kurye_id || p.kurye_id === '';
    const benimUzerimde = p.kurye_id === kuryeId;
    return sahipsiz || benimUzerimde;
  });

  // 2. SADECE bu kuryenin teslim ettiği paketler
  const teslimEdilenler = paketler.filter((p) => {
    const tamamlandi = p.asama === 'teslim_edildi' || p.durum === 'teslim_edildi';
    return tamamlandi && p.kurye_id === kuryeId;
  });

  return { paketler, aktifPaketler, teslimEdilenler, yukleniyor, paketiAl, paketiTeslimAldiBildir, teslimEt, paketiIptalEt };
};
