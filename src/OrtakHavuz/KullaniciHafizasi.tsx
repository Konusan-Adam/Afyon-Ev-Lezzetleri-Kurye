import React, { createContext, useContext, useState, useEffect } from 'react';
import { Kullanici, KullaniciRolu } from '@/src/veritabani/VeriTipleri';
import {
  kuryeGirisYap,
  kuryeKayitOl,
  type KuryeKayitBilgisi,
  type KuryeKimlikSonucu
} from '@/src/MalzemeCekmeceleri/KuryeTeslimat/kuryeKimlikServisi';

export type PanelTipi = 'vitrin' | 'patron' | 'musteri' | 'mutfak' | 'kurye';

interface KullaniciHafizaTipi {
  aktifKullanici: Kullanici | null;
  pencereAcik: boolean;
  baslangicSekmesi: 'giris' | 'kayit';
  baslangicRolu: KullaniciRolu;
  yukleniyor: boolean;
  goruntulenenPanel: PanelTipi;
  panelDegistir: (panel: PanelTipi) => void;
  yonetimModuAcik: boolean;
  yonetimModunuAyarla: (acik: boolean) => void;
  pencereAc: (baslangicSekmesi?: 'giris' | 'kayit' | any, baslangicRolu?: KullaniciRolu) => void;
  pencereKapat: () => void;
  girisYap: (telefon: string, sifre: string) => Promise<boolean>;
  kuryeOlarakGirisYap: (telefon: string, sifre: string) => Promise<KuryeKimlikSonucu>;
  kuryeOlarakKayitOl: (bilgiler: KuryeKayitBilgisi) => Promise<KuryeKimlikSonucu>;
  cikisYap: () => void;
  testRoluneGec: (rol: KullaniciRolu) => void;
}

const KullaniciContext = createContext<KullaniciHafizaTipi | undefined>(undefined);

const OTURUM_ANAHTARI = 'afyon_oturum_kullanici';

export const KullaniciSaglayici: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [aktifKullanici, setAktifKullanici] = useState<Kullanici | null>(() => {
    try {
      const kayitliOturum = localStorage.getItem(OTURUM_ANAHTARI);
      if (!kayitliOturum) return null;
      const parsed = JSON.parse(kayitliOturum) as Kullanici;
      if (parsed && parsed.rol === 'kurye') {
        return parsed;
      }
      localStorage.removeItem(OTURUM_ANAHTARI);
      return null;
    } catch {
      return null;
    }
  });

  const [pencereAcik, setPencereAcik] = useState<boolean>(false);
  const [baslangicSekmesi, setBaslangicSekmesi] = useState<'giris' | 'kayit'>('giris');
  const [baslangicRolu, setBaslangicRolu] = useState<KullaniciRolu>('kurye');
  const [yukleniyor, setYukleniyor] = useState<boolean>(false);
  const [goruntulenenPanel, setGoruntulenenPanel] = useState<PanelTipi>('kurye');

  useEffect(() => {
    if (aktifKullanici && aktifKullanici.rol === 'kurye') {
      localStorage.setItem(OTURUM_ANAHTARI, JSON.stringify(aktifKullanici));
    } else {
      localStorage.removeItem(OTURUM_ANAHTARI);
    }
  }, [aktifKullanici]);

  const panelDegistir = (panel: PanelTipi) => {
    setGoruntulenenPanel(panel);
  };

  const yonetimModunuAyarla = (acik: boolean) => {
    setGoruntulenenPanel(acik ? 'patron' : 'kurye');
  };

  const testRoluneGec = (_rol: KullaniciRolu) => {
    setGoruntulenenPanel('kurye');
  };

  const kuryeOlarakGirisYap = async (
    telefon: string,
    sifre: string
  ): Promise<KuryeKimlikSonucu> => {
    setYukleniyor(true);
    const sonuc = await kuryeGirisYap(telefon, sifre);
    setYukleniyor(false);

    if (sonuc.basarili && sonuc.kullanici) {
      setAktifKullanici(sonuc.kullanici);
      setPencereAcik(false);
      setGoruntulenenPanel('kurye');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('afyon_oturum_degisti', { detail: { aktifKullanici: sonuc.kullanici } })
        );
      }
    }
    return sonuc;
  };

  const girisYap = async (telefon: string, sifre: string): Promise<boolean> => {
    const sonuc = await kuryeOlarakGirisYap(telefon, sifre);
    return sonuc.basarili;
  };

  const kuryeOlarakKayitOl = async (
    bilgiler: KuryeKayitBilgisi
  ): Promise<KuryeKimlikSonucu> => {
    setYukleniyor(true);
    const sonuc = await kuryeKayitOl(bilgiler);
    setYukleniyor(false);

    if (sonuc.basarili && sonuc.kullanici) {
      setAktifKullanici(sonuc.kullanici);
      setPencereAcik(false);
      setGoruntulenenPanel('kurye');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('afyon_oturum_degisti', { detail: { aktifKullanici: sonuc.kullanici } })
        );
      }
    }
    return sonuc;
  };

  const cikisYap = () => {
    setAktifKullanici(null);
    localStorage.removeItem(OTURUM_ANAHTARI);
    localStorage.removeItem('afyon_misafir_secili_adres');
    localStorage.removeItem('afyon_secili_mahalle');
    localStorage.removeItem('afyon_son_misafir_telefon');
    localStorage.removeItem('afyon_son_misafir_ad');
    setGoruntulenenPanel('kurye');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('afyon_oturum_degisti', { detail: { aktifKullanici: null } }));
    }
  };

  return (
    <KullaniciContext.Provider
      value={{
        aktifKullanici,
        pencereAcik,
        baslangicSekmesi,
        baslangicRolu,
        yukleniyor,
        goruntulenenPanel,
        panelDegistir,
        yonetimModuAcik: goruntulenenPanel === 'patron',
        yonetimModunuAyarla,
        pencereAc: (sekme?: any) => {
          setBaslangicSekmesi(sekme === 'kayit' ? 'kayit' : 'giris');
          setBaslangicRolu('kurye');
          setPencereAcik(true);
        },
        pencereKapat: () => setPencereAcik(false),
        girisYap,
        kuryeOlarakGirisYap,
        kuryeOlarakKayitOl,
        cikisYap,
        testRoluneGec
      }}
    >
      {children}
    </KullaniciContext.Provider>
  );
};

export const kullaniciHafizasiKullan = () => {
  const context = useContext(KullaniciContext);
  if (!context) {
    throw new Error('kullaniciHafizasiKullan, KullaniciSaglayici içinde kullanılmalıdır');
  }
  return context;
};
