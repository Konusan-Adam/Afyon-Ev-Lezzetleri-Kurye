import { useEffect, useMemo, useRef, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db, canliFirebaseAktifMi } from '@/src/veritabani/FirebaseIstemcisi';
import { firestoreHatasiniYonet, IslemTipi } from '@/src/veritabani/FirebaseHataYoneticisi';
import { kuryeZiliCal } from './KuryeZilServisi';
import {
  SubeSiparisi,
  subeSiparisiKabulEt,
  subeSiparisiTeslimAl,
  subeSiparisiTeslimEt,
  subeSiparisStokIadeEtTransaction
} from './SubeSiparisServisi';

function yetkiHatasiMi(hata: unknown): boolean {
  if (!hata) return false;
  const mesaj = hata instanceof Error ? hata.message : String(hata);
  return (
    mesaj.includes('permission') ||
    mesaj.includes('insufficient') ||
    (hata as any)?.code === 'permission-denied'
  );
}

export const useKuryeSubeSiparisleri = (
  kuryeId: string,
  kuryeAdi: string,
  kuryeTelefon: string = ''
) => {
  const [havuzSiparisleri, setHavuzSiparisleri] = useState<SubeSiparisi[]>([]);
  const [benimAktifSiparislerim, setBenimAktifSiparislerim] = useState<SubeSiparisi[]>([]);
  const [teslimEdilenSubeSiparisleri, setTeslimEdilenSubeSiparisleri] = useState<SubeSiparisi[]>([]);
  const [yukleniyor, setYukleniyor] = useState<boolean>(true);

  const bilinenHavuzIdleriRef = useRef<Set<string>>(new Set());
  const ilkHavuzYuklendiRef = useRef<boolean>(false);
  const iadeIslemindekiIdlerRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!canliFirebaseAktifMi()) {
      setHavuzSiparisleri([]);
      setBenimAktifSiparislerim([]);
      setTeslimEdilenSubeSiparisleri([]);
      setYukleniyor(false);
      return;
    }

    const subeSiparisKoleksiyonu = collection(db, 'sube_siparisleri');

    // 1. Kurye Havuzu: teslimat_tipi == 'teslimat' ve durum == 'teslime_hazir'
    const havuzSorgusu = query(
      subeSiparisKoleksiyonu,
      where('teslimat_tipi', '==', 'teslimat'),
      where('durum', '==', 'teslime_hazir')
    );

    const havuzAboneligi = onSnapshot(
      havuzSorgusu,
      (snap) => {
        const liste = snap.docs.map((d) => ({
          id: d.id,
          ...d.data()
        })) as SubeSiparisi[];

        if (ilkHavuzYuklendiRef.current) {
          for (const siparis of liste) {
            const sahipsiz = !siparis.kurye_id || siparis.kurye_id === '';
            if (sahipsiz && !bilinenHavuzIdleriRef.current.has(siparis.id)) {
              kuryeZiliCal(
                'Yeni Şube Paketi Hazır! 🏪',
                `${siparis.sube_adi || 'Şube'} — #${siparis.siparis_kodu || siparis.id} kurye bekliyor.`
              );
            }
          }
        }

        bilinenHavuzIdleriRef.current = new Set(liste.map((s) => s.id));
        ilkHavuzYuklendiRef.current = true;
        setHavuzSiparisleri(liste);
        setYukleniyor(false);
      },
      (hata) => {
        setYukleniyor(false);
        if (yetkiHatasiMi(hata)) {
          firestoreHatasiniYonet(hata, IslemTipi.LIST, 'sube_siparisleri');
        }
        console.warn('Şube sipariş havuzu dinleme hatası:', hata);
      }
    );

    // 2. Kuryenin aktif görevleri: kurye_id == aktifKuryeId ve durum in ['teslime_hazir', 'yolda']
    let aktifGorevAboneligi = () => {};
    let teslimEdilenAboneligi = () => {};

    if (kuryeId) {
      const aktifGorevSorgusu = query(
        subeSiparisKoleksiyonu,
        where('kurye_id', '==', kuryeId),
        where('durum', 'in', ['teslime_hazir', 'yolda'])
      );

      aktifGorevAboneligi = onSnapshot(
        aktifGorevSorgusu,
        (snap) => {
          const liste = snap.docs.map((d) => ({
            id: d.id,
            ...d.data()
          })) as SubeSiparisi[];
          setBenimAktifSiparislerim(liste);
        },
        (hata) => {
          if (yetkiHatasiMi(hata)) {
            firestoreHatasiniYonet(hata, IslemTipi.LIST, 'sube_siparisleri');
          }
          console.warn('Aktif şube görevleri dinleme hatası:', hata);
        }
      );

      const teslimEdilenSorgusu = query(
        subeSiparisKoleksiyonu,
        where('kurye_id', '==', kuryeId),
        where('durum', '==', 'teslim_edildi')
      );

      teslimEdilenAboneligi = onSnapshot(
        teslimEdilenSorgusu,
        (snap) => {
          const liste = snap.docs.map((d) => ({
            id: d.id,
            ...d.data()
          })) as SubeSiparisi[];
          setTeslimEdilenSubeSiparisleri(liste);
        },
        (hata) => {
          if (yetkiHatasiMi(hata)) {
            firestoreHatasiniYonet(hata, IslemTipi.LIST, 'sube_siparisleri');
          }
          console.warn('Teslim edilen şube siparişleri dinleme hatası:', hata);
        }
      );
    }

    // 3. İptal & Stok İadesi Senkronizasyonu: durum == 'iptal' ve stok_iade_edildi_mi != true
    const iptalSorgusu = query(subeSiparisKoleksiyonu, where('durum', '==', 'iptal'));
    const iptalAboneligi = onSnapshot(
      iptalSorgusu,
      (snap) => {
        for (const belge of snap.docs) {
          const veri = belge.data() as SubeSiparisi;
          if (veri.stok_iade_edildi_mi === true) continue;
          if (iadeIslemindekiIdlerRef.current.has(belge.id)) continue;

          iadeIslemindekiIdlerRef.current.add(belge.id);
          subeSiparisStokIadeEtTransaction(belge.id).finally(() => {
            iadeIslemindekiIdlerRef.current.delete(belge.id);
          });
        }
      },
      (hata) => {
        if (yetkiHatasiMi(hata)) {
          firestoreHatasiniYonet(hata, IslemTipi.LIST, 'sube_siparisleri');
        }
        console.warn('İptal edilen şube siparişleri dinleme hatası:', hata);
      }
    );

    return () => {
      havuzAboneligi();
      aktifGorevAboneligi();
      teslimEdilenAboneligi();
      iptalAboneligi();
    };
  }, [kuryeId]);

  const aktifSubeSiparisleri = useMemo(() => {
    const harita = new Map<string, SubeSiparisi>();

    for (const siparis of havuzSiparisleri) {
      const sahipsiz = !siparis.kurye_id || siparis.kurye_id === '';
      const benimUzerimde = siparis.kurye_id === kuryeId;
      if (sahipsiz || benimUzerimde) {
        harita.set(siparis.id, siparis);
      }
    }

    for (const siparis of benimAktifSiparislerim) {
      harita.set(siparis.id, siparis);
    }

    return Array.from(harita.values()).sort((a, b) => {
      const aBenim = a.kurye_id === kuryeId ? 0 : 1;
      const bBenim = b.kurye_id === kuryeId ? 0 : 1;
      return aBenim - bBenim;
    });
  }, [havuzSiparisleri, benimAktifSiparislerim, kuryeId]);

  const kabulEt = async (siparisId: string) => {
    return await subeSiparisiKabulEt(siparisId, kuryeId, kuryeAdi, kuryeTelefon);
  };

  const teslimAl = async (siparisId: string, girilenPin?: string) => {
    return await subeSiparisiTeslimAl(siparisId, kuryeId, kuryeAdi, kuryeTelefon, girilenPin);
  };

  const teslimEt = async (siparisId: string) => {
    const siparis = aktifSubeSiparisleri.find((s) => s.id === siparisId);
    return await subeSiparisiTeslimEt(siparisId, {
      siparisKodu: siparis?.siparis_kodu || siparisId,
      kuryeId,
      kuryeAdi,
      kuryeTelefon,
      tutar: Number(siparis?.toplam_tutar ?? 0)
    });
  };

  return {
    aktifSubeSiparisleri,
    teslimEdilenSubeSiparisleri,
    yukleniyor,
    kabulEt,
    teslimAl,
    teslimEt
  };
};
