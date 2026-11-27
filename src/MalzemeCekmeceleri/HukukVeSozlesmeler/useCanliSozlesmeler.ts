import { useEffect, useMemo, useState } from 'react';
import {
  sozlesmeEkranUygunMu,
  sozlesmeleriCanliDinle,
  type HedefEkranTipi
} from './hukukDeposu';
import type { HukukiSozlesme } from './tipler';

export function useCanliSozlesmeler(ekran: HedefEkranTipi = 'kurye_basvuru') {
  const [tumSozlesmeler, setTumSozlesmeler] = useState<HukukiSozlesme[]>([]);
  const [yukleniyor, setYukleniyor] = useState<boolean>(true);
  const [hata, setHata] = useState<string>('');

  useEffect(() => {
    setYukleniyor(true);
    setHata('');

    const aboneligiBitir = sozlesmeleriCanliDinle(
      (liste) => {
        setTumSozlesmeler(liste);
        setYukleniyor(false);
      },
      (hataMesaji) => {
        setHata(hataMesaji);
        setYukleniyor(false);
      }
    );

    return () => {
      aboneligiBitir();
    };
  }, []);

  const sozlesmeler = useMemo(
    () => tumSozlesmeler.filter((s) => sozlesmeEkranUygunMu(s, ekran)),
    [tumSozlesmeler, ekran]
  );

  const sozlesmeHaritasi = useMemo(() => {
    const harita: Record<string, HukukiSozlesme> = {};
    for (const s of tumSozlesmeler) {
      harita[s.tur] = s;
    }
    return harita;
  }, [tumSozlesmeler]);

  return {
    sozlesmeler,
    tumSozlesmeler,
    sozlesmeHaritasi,
    yukleniyor,
    hata
  };
}
