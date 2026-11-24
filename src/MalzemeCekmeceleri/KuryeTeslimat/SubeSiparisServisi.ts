import { doc, runTransaction, updateDoc } from 'firebase/firestore';
import { db, canliFirebaseAktifMi } from '@/src/veritabani/FirebaseIstemcisi';
import { firestoreHatasiniYonet, IslemTipi } from '@/src/veritabani/FirebaseHataYoneticisi';
import { patronBildirimiEkle } from '@/src/MalzemeCekmeceleri/PatronBildirimServisi';
import { hukukiDelilDamgala } from '@/src/MalzemeCekmeceleri/HukukVeSozlesmeler/hukukiDelilServisi';

export interface SubeSiparisUrunu {
  urun_id?: string;
  id?: string;
  ad?: string;
  urun_adi?: string;
  adet?: number;
  miktar?: number;
  fiyat?: number;
  birim_fiyat?: number;
}

export interface SubeSiparisi {
  id: string;
  sube_id?: string;
  sube_adi?: string;
  siparis_kodu?: string;
  pin_kodu?: string | number;
  teslimat_tipi?: string;
  durum?: string;
  teslimat_adresi_metni?: string;
  musteri_adi?: string;
  musteri_telefon?: string;
  musteri_konum?: { enlem: number; boylam: number };
  toplam_tutar?: number;
  siparis_notu?: string;
  kurye_id?: string | null;
  kurye_adi?: string | null;
  kurye_telefon?: string | null;
  stok_iade_edildi_mi?: boolean;
  urunler?: SubeSiparisUrunu[];
  olusturulma_tarihi?: any;
}

function yetkiHatasiMi(hata: unknown): boolean {
  if (!hata) return false;
  const mesaj = hata instanceof Error ? hata.message : String(hata);
  return (
    mesaj.includes('permission') ||
    mesaj.includes('insufficient') ||
    (hata as any)?.code === 'permission-denied'
  );
}

/**
 * 1. Kurye şube işini kabul ettiğinde (şubeye almaya giderken):
 *    `sube_siparisleri/{siparisId}` üzerinde yalnızca
 *    `{ kurye_id, kurye_adi, kurye_telefon }` alanlarını günceller (`durum` 'teslime_hazir' kalır).
 */
export async function subeSiparisiKabulEt(
  siparisId: string,
  kuryeId: string,
  kuryeAdi: string,
  kuryeTelefon: string = ''
): Promise<{ basarili: boolean; mesaj: string }> {
  if (!canliFirebaseAktifMi()) {
    return { basarili: false, mesaj: 'Canlı Firestore bağlantısı aktif değil.' };
  }

  const siparisYolu = `sube_siparisleri/${siparisId}`;
  try {
    const sonuc = await runTransaction(db, async (tx) => {
      const siparisRef = doc(db, 'sube_siparisleri', siparisId);
      const siparisSnap = await tx.get(siparisRef);

      if (!siparisSnap.exists()) {
        return { basarili: false, mesaj: 'Şube siparişi bulunamadı.' };
      }

      const veri = siparisSnap.data() as SubeSiparisi;
      if (veri.durum !== 'teslime_hazir') {
        return {
          basarili: false,
          mesaj: 'Bu şube siparişi artık teslimata hazır durumda değil.'
        };
      }

      if (veri.kurye_id && veri.kurye_id !== '' && veri.kurye_id !== kuryeId) {
        return {
          basarili: false,
          mesaj: 'Bu şube siparişi az önce başka bir kurye tarafından kabul edildi.'
        };
      }

      tx.update(siparisRef, {
        kurye_id: kuryeId,
        kurye_adi: kuryeAdi,
        kurye_telefon: String(kuryeTelefon || '').trim()
      });

      return {
        basarili: true,
        mesaj: 'Şube siparişi kabul edildi! Şubeye gidip paketi teslim alabilirsiniz.',
        siparisKodu: veri.siparis_kodu || siparisId,
        subeAdi: veri.sube_adi || 'Şube'
      };
    });

    if (sonuc.basarili) {
      patronBildirimiEkle(
        'siparis_durumu',
        'Şube Siparişi Kurye Tarafından Kabul Edildi 🛵',
        `Kurye ${kuryeAdi}, ${sonuc.subeAdi} (#${sonuc.siparisKodu}) siparişini almak için şubeye yöneldi.`,
        siparisId
      );

      hukukiDelilDamgala({
        sozlesmeTuru: 'kurye_paket_teslim_alma',
        sozlesmeVersiyonu: '1.0.0',
        islemTuru: 'ozel_onay',
        onaylandiMi: true,
        ilgiliKayitId: String(sonuc.siparisKodu || siparisId),
        kullaniciKimlik: kuryeId,
        kullaniciTelefon: kuryeTelefon,
        kullaniciAdSoyad: kuryeAdi,
        ekDetay: {
          adim: 'sube_isi_kabul',
          kaynak: 'sube_siparisleri',
          subeAdi: sonuc.subeAdi
        }
      }).catch((err) => {
        console.warn('Şube işi kabul hukuki damga uyarısı:', err);
      });
    }

    return { basarili: sonuc.basarili, mesaj: sonuc.mesaj };
  } catch (hata: any) {
    if (yetkiHatasiMi(hata)) {
      firestoreHatasiniYonet(hata, IslemTipi.UPDATE, siparisYolu);
    }
    return {
      basarili: false,
      mesaj: hata?.message || 'Şube siparişi kabul edilirken hata oluştu.'
    };
  }
}

/**
 * 2. Kurye paketi şubeden teslim aldığında (isteğe bağlı `pin_kodu` doğrulaması ile):
 *    `sube_siparisleri/{siparisId}` üzerinde `{ durum: 'yolda', kurye_id, kurye_adi, kurye_telefon }` günceller.
 */
export async function subeSiparisiTeslimAl(
  siparisId: string,
  kuryeId: string,
  kuryeAdi: string,
  kuryeTelefon: string = '',
  girilenPin?: string
): Promise<{ basarili: boolean; mesaj: string }> {
  if (!canliFirebaseAktifMi()) {
    return { basarili: false, mesaj: 'Canlı Firestore bağlantısı aktif değil.' };
  }

  const siparisYolu = `sube_siparisleri/${siparisId}`;
  try {
    const sonuc = await runTransaction(db, async (tx) => {
      const siparisRef = doc(db, 'sube_siparisleri', siparisId);
      const siparisSnap = await tx.get(siparisRef);

      if (!siparisSnap.exists()) {
        return { basarili: false, mesaj: 'Şube siparişi bulunamadı.' };
      }

      const veri = siparisSnap.data() as SubeSiparisi;
      if (veri.durum !== 'teslime_hazir' && veri.durum !== 'yolda') {
        return {
          basarili: false,
          mesaj: 'Sipariş şubeden teslim alınabilecek durumda değil.'
        };
      }

      const temizGirilenPin = String(girilenPin || '').trim();
      const gercekPin = String(veri.pin_kodu ?? '').trim();
      if (temizGirilenPin !== '' && gercekPin !== '' && temizGirilenPin !== gercekPin) {
        return {
          basarili: false,
          mesaj: 'Hatalı PIN kodu! Lütfen şube siparişindeki PIN kodunu kontrol ediniz.'
        };
      }

      tx.update(siparisRef, {
        durum: 'yolda',
        kurye_id: kuryeId,
        kurye_adi: kuryeAdi,
        kurye_telefon: String(kuryeTelefon || '').trim()
      });

      return {
        basarili: true,
        mesaj: 'Paket şubeden teslim alındı! Müşteri adresine teslimat başlatıldı.',
        siparisKodu: veri.siparis_kodu || siparisId
      };
    });

    if (sonuc.basarili) {
      patronBildirimiEkle(
        'siparis_durumu',
        'Şube Paketi Yola Çıktı 📦',
        `Kurye ${kuryeAdi}, #${sonuc.siparisKodu} nolu şube siparişini teslim aldı ve müşteriye doğru yola çıktı.`,
        siparisId
      );

      hukukiDelilDamgala({
        sozlesmeTuru: 'kurye_paket_teslim_alma',
        sozlesmeVersiyonu: '1.0.0',
        islemTuru: 'ozel_onay',
        onaylandiMi: true,
        ilgiliKayitId: String(sonuc.siparisKodu || siparisId),
        kullaniciKimlik: kuryeId,
        kullaniciTelefon: kuryeTelefon,
        kullaniciAdSoyad: kuryeAdi,
        ekDetay: {
          adim: 'subeden_teslim_alma',
          kaynak: 'sube_siparisleri',
          pinDogrulandiMi: Boolean(girilenPin && girilenPin.trim())
        }
      }).catch((err) => {
        console.warn('Şubeden teslim alma hukuki damga uyarısı:', err);
      });
    }

    return { basarili: sonuc.basarili, mesaj: sonuc.mesaj };
  } catch (hata: any) {
    if (yetkiHatasiMi(hata)) {
      firestoreHatasiniYonet(hata, IslemTipi.UPDATE, siparisYolu);
    }
    return {
      basarili: false,
      mesaj: hata?.message || 'Şube paketi teslim alınırken hata oluştu.'
    };
  }
}

/**
 * 3. Kurye siparişi müşteriye teslim ettiğinde:
 *    `sube_siparisleri/{siparisId}` üzerinde `{ durum: 'teslim_edildi' }` günceller.
 */
export async function subeSiparisiTeslimEt(
  siparisId: string,
  ekBilgi?: {
    siparisKodu?: string;
    kuryeId?: string;
    kuryeAdi?: string;
    kuryeTelefon?: string;
    tutar?: number;
  }
): Promise<{ basarili: boolean; mesaj: string }> {
  if (!canliFirebaseAktifMi()) {
    return { basarili: false, mesaj: 'Canlı Firestore bağlantısı aktif değil.' };
  }

  const siparisYolu = `sube_siparisleri/${siparisId}`;
  try {
    const siparisRef = doc(db, 'sube_siparisleri', siparisId);
    await updateDoc(siparisRef, {
      durum: 'teslim_edildi'
    });

    const siparisKodu = String(ekBilgi?.siparisKodu || siparisId);
    patronBildirimiEkle(
      'siparis_durumu',
      'Şube Siparişi Teslim Edildi 🎉',
      `#${siparisKodu} nolu şube siparişi müşteriye teslim edildi.`,
      siparisId
    );

    hukukiDelilDamgala({
      sozlesmeTuru: 'teslimat_pin_qr_onayi',
      sozlesmeVersiyonu: '1.0.0',
      islemTuru: 'teslimat',
      onaylandiMi: true,
      ilgiliKayitId: siparisKodu,
      kullaniciKimlik: ekBilgi?.kuryeId || '',
      kullaniciTelefon: ekBilgi?.kuryeTelefon || '',
      kullaniciAdSoyad: ekBilgi?.kuryeAdi || '',
      ekDetay: {
        dogrulamaYontemi: 'pin',
        kuryeId: ekBilgi?.kuryeId || '',
        tutar: Number(ekBilgi?.tutar ?? 0),
        kaynak: 'sube_siparisleri'
      }
    }).catch((err) => {
      console.warn('Şube teslimat hukuki damga uyarısı:', err);
    });

    return { basarili: true, mesaj: 'Şube siparişi müşteriye başarıyla teslim edildi!' };
  } catch (hata: any) {
    if (yetkiHatasiMi(hata)) {
      firestoreHatasiniYonet(hata, IslemTipi.UPDATE, siparisYolu);
    }
    return {
      basarili: false,
      mesaj: hata?.message || 'Şube siparişi teslim edilirken hata oluştu.'
    };
  }
}

/**
 * 4. İptal & Stok İadesi Senkronizasyonu:
 *    Bir `sube_siparisleri` belgesi `durum: 'iptal'` yapıldığında, `runTransaction` içinde
 *    `stok_iade_edildi_mi != true` kontrolüyle `urunler[].urun_id` üzerindeki
 *    `sube_stoklari` `stok_adedi` değerlerini geri artırır ve siparişe `stok_iade_edildi_mi: true` yazar.
 */
export async function subeSiparisStokIadeEtTransaction(siparisId: string): Promise<boolean> {
  if (!canliFirebaseAktifMi()) return false;

  const siparisYolu = `sube_siparisleri/${siparisId}`;
  try {
    const iadeYapildiMi = await runTransaction(db, async (tx) => {
      const siparisRef = doc(db, 'sube_siparisleri', siparisId);
      const siparisSnap = await tx.get(siparisRef);

      if (!siparisSnap.exists()) return false;

      const siparisVeri = siparisSnap.data() as SubeSiparisi;
      if (siparisVeri.durum !== 'iptal' || siparisVeri.stok_iade_edildi_mi === true) {
        return false;
      }

      const urunMiktarHaritasi = new Map<string, number>();
      const urunler = Array.isArray(siparisVeri.urunler) ? siparisVeri.urunler : [];

      for (const urun of urunler) {
        const urunId = String(urun?.urun_id || urun?.id || '').trim();
        if (!urunId) continue;
        const adet = Number(urun?.adet ?? urun?.miktar ?? 1);
        if (!Number.isFinite(adet) || adet <= 0) continue;
        urunMiktarHaritasi.set(urunId, (urunMiktarHaritasi.get(urunId) || 0) + adet);
      }

      // Firestore transaction kuralı: Tüm get() okumaları update() yazmalarından ÖNCE yapılmalı
      const stokGuncellemeleri: Array<{
        stokRef: ReturnType<typeof doc>;
        yeniStok: number;
      }> = [];

      for (const [urunId, iadeAdedi] of urunMiktarHaritasi.entries()) {
        const dogrudanStokRef = doc(db, 'sube_stoklari', urunId);
        const dogrudanSnap = await tx.get(dogrudanStokRef);

        if (dogrudanSnap.exists()) {
          const mevcutStok = Number(dogrudanSnap.data()?.stok_adedi ?? 0);
          stokGuncellemeleri.push({
            stokRef: dogrudanStokRef,
            yeniStok: mevcutStok + iadeAdedi
          });
          continue;
        }

        if (siparisVeri.sube_id) {
          const bilesikStokRef = doc(db, 'sube_stoklari', `${siparisVeri.sube_id}_${urunId}`);
          const bilesikSnap = await tx.get(bilesikStokRef);
          if (bilesikSnap.exists()) {
            const mevcutStok = Number(bilesikSnap.data()?.stok_adedi ?? 0);
            stokGuncellemeleri.push({
              stokRef: bilesikStokRef,
              yeniStok: mevcutStok + iadeAdedi
            });
          }
        }
      }

      for (const guncelleme of stokGuncellemeleri) {
        tx.update(guncelleme.stokRef, {
          stok_adedi: guncelleme.yeniStok
        });
      }

      tx.update(siparisRef, {
        stok_iade_edildi_mi: true
      });

      return true;
    });

    return iadeYapildiMi;
  } catch (hata) {
    if (yetkiHatasiMi(hata)) {
      firestoreHatasiniYonet(hata, IslemTipi.WRITE, siparisYolu);
    }
    console.warn(`Şube siparişi (${siparisId}) stok iadesi transaction hatası:`, hata);
    return false;
  }
}
