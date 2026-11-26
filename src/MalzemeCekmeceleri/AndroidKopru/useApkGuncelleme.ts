import { useCallback, useEffect, useState } from 'react';
import {
  androidApkGuncelleIndirVeKur,
  androidOrtamiMi,
  androidUygulamaSurumuGetir
} from './AndroidKopruServisi';

export interface ApkMetaBilgisi {
  version: string;
  versionCode: number;
  builtAt: string;
  builtTimestamp: number;
}

export interface YeniApkSurumBilgisi {
  surumAdi: string;
  surumKodu: number;
  derlemeZamani: number;
  yayinTarihiMetni: string;
  indirmeAdresi: string;
  aciklama?: string;
}

const GITHUB_SURUM_DEPOSU = (import.meta.env.VITE_GITHUB_RELEASES_REPO || '').trim();
const CANLI_UYGULAMA_ADRESI = (import.meta.env.VITE_CANLI_APK_SUNUCU_URL || '').trim();

function guvenliHttpsAdresiMi(adres: string): boolean {
  try {
    const url = new URL(adres);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function useApkGuncelleme() {
  const [guncellemeVar, setGuncellemeVar] = useState(false);
  const [yeniSurumBilgisi, setYeniSurumBilgisi] = useState<YeniApkSurumBilgisi | null>(null);
  const [kontrolEdiliyor, setKontrolEdiliyor] = useState(false);
  const [indiriliyor, setIndiriliyor] = useState(false);
  const [hataMesaji, setHataMesaji] = useState('');
  const [kapatildi, setKapatildi] = useState(false);

  const guncellemeKontrolEt = useCallback(async () => {
    setKontrolEdiliyor(true);
    setHataMesaji('');

    try {
      let yerelMeta: ApkMetaBilgisi | null = null;
      try {
        const yerelYanit = await fetch('./apk-meta.json', { cache: 'no-store' });
        if (yerelYanit.ok) {
          yerelMeta = await yerelYanit.json();
        }
      } catch {
        // Yerel meta okunamazsa native sürüm koduna düş
      }

      const nativeBilgi = androidUygulamaSurumuGetir();
      const yerelZaman = Number(yerelMeta?.builtTimestamp || 0);
      const yerelSurumKodu = Number(nativeBilgi?.surumKodu || yerelMeta?.versionCode || 0);

      // 1. GitHub Releases (latest) kontrolü
      if (GITHUB_SURUM_DEPOSU) {
        const apiUrl = `https://api.github.com/repos/${GITHUB_SURUM_DEPOSU}/releases/latest`;
        const ghYanit = await fetch(apiUrl, {
          headers: { Accept: 'application/vnd.github+json' },
          cache: 'no-store'
        });

        if (ghYanit.ok) {
          const release = await ghYanit.json();
          const varliklar: any[] = Array.isArray(release.assets) ? release.assets : [];
          const apkVarligi = varliklar.find((v) => String(v.name || '').endsWith('.apk'));
          const metaVarligi = varliklar.find((v) => String(v.name || '') === 'apk-meta.json');

          let uzakZaman = release.published_at ? Date.parse(release.published_at) : 0;
          let uzakSurumKodu = 0;
          let uzakSurumAdi = String(release.tag_name || '').replace(/^v/i, '') || '1.0.0';

          if (metaVarligi?.browser_download_url && guvenliHttpsAdresiMi(metaVarligi.browser_download_url)) {
            try {
              const metaYanit = await fetch(metaVarligi.browser_download_url, { cache: 'no-store' });
              if (metaYanit.ok) {
                const uzakMeta: ApkMetaBilgisi = await metaYanit.json();
                uzakZaman = Number(uzakMeta.builtTimestamp || uzakZaman);
                uzakSurumKodu = Number(uzakMeta.versionCode || 0);
                uzakSurumAdi = uzakMeta.version || uzakSurumAdi;
              }
            } catch {
              // Yoksay
            }
          }

          const indirmeAdresi = apkVarligi?.browser_download_url || '';
          const dahaYeniZaman = yerelZaman > 0 && uzakZaman > yerelZaman + 5000;
          const dahaYeniKod = yerelSurumKodu > 0 && uzakSurumKodu > yerelSurumKodu;

          if ((dahaYeniZaman || dahaYeniKod) && guvenliHttpsAdresiMi(indirmeAdresi)) {
            setYeniSurumBilgisi({
              surumAdi: uzakSurumAdi,
              surumKodu: uzakSurumKodu || yerelSurumKodu + 1,
              derlemeZamani: uzakZaman,
              yayinTarihiMetni: new Date(uzakZaman).toLocaleString('tr-TR'),
              indirmeAdresi,
              aciklama: release.name || 'Yeni Afyon Kurye APK sürümü yayında.'
            });
            setGuncellemeVar(true);
            return;
          }
        }
      }

      // 2. Canlı sunucu üzerinden apk-meta.json kontrolü
      if (androidOrtamiMi() && CANLI_UYGULAMA_ADRESI && guvenliHttpsAdresiMi(CANLI_UYGULAMA_ADRESI)) {
        const temizKok = CANLI_UYGULAMA_ADRESI.replace(/\/+$/, '');
        const uzakMetaYanit = await fetch(`${temizKok}/apk-meta.json`, { cache: 'no-store' });
        if (uzakMetaYanit.ok) {
          const uzakMeta: ApkMetaBilgisi = await uzakMetaYanit.json();
          const uzakZaman = Number(uzakMeta.builtTimestamp || 0);
          const uzakSurumKodu = Number(uzakMeta.versionCode || 0);
          const dahaYeniZaman = yerelZaman > 0 && uzakZaman > yerelZaman + 5000;
          const dahaYeniKod = yerelSurumKodu > 0 && uzakSurumKodu > yerelSurumKodu;

          if (dahaYeniZaman || dahaYeniKod) {
            setYeniSurumBilgisi({
              surumAdi: uzakMeta.version || '1.0.0',
              surumKodu: uzakSurumKodu,
              derlemeZamani: uzakZaman,
              yayinTarihiMetni: new Date(uzakZaman).toLocaleString('tr-TR'),
              indirmeAdresi: `${temizKok}/afyon-kurye.apk`,
              aciklama: 'Arka plan uyandırma ve güncel özellikler içeren yeni APK hazır.'
            });
            setGuncellemeVar(true);
            return;
          }
        }
      }

      setGuncellemeVar(false);
    } catch {
      setGuncellemeVar(false);
    } finally {
      setKontrolEdiliyor(false);
    }
  }, []);

  useEffect(() => {
    guncellemeKontrolEt();
  }, [guncellemeKontrolEt]);

  const simdiGuncelle = useCallback(() => {
    if (!yeniSurumBilgisi?.indirmeAdresi) return;
    setIndiriliyor(true);
    setHataMesaji('');

    try {
      const nativeBasladi = androidApkGuncelleIndirVeKur(yeniSurumBilgisi.indirmeAdresi);
      if (!nativeBasladi && typeof document !== 'undefined') {
        const baglanti = document.createElement('a');
        baglanti.href = yeniSurumBilgisi.indirmeAdresi;
        baglanti.download = 'afyon-kurye.apk';
        document.body.appendChild(baglanti);
        baglanti.click();
        document.body.removeChild(baglanti);
      }
    } catch (hata: any) {
      setHataMesaji(hata?.message || 'Güncelleme başlatılamadı.');
    } finally {
      setTimeout(() => setIndiriliyor(false), 3000);
    }
  }, [yeniSurumBilgisi]);

  const uyariyiKapat = useCallback(() => {
    setKapatildi(true);
  }, []);

  return {
    guncellemeVar: guncellemeVar && !kapatildi,
    yeniSurumBilgisi,
    kontrolEdiliyor,
    indiriliyor,
    hataMesaji,
    simdiGuncelle,
    uyariyiKapat,
    yenidenKontrolEt: guncellemeKontrolEt
  };
}
