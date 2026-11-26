import { canliFirebaseAktifMi } from '@/src/veritabani/FirebaseIstemcisi';
import { belgeKaydet, koleksiyonGetir } from '@/src/veritabani/FirebaseKoleksiyonServisi';
import { patronBildirimiEkle } from '@/src/MalzemeCekmeceleri/PatronBildirimServisi';
import { yerelSiparisDurumGuncelle, yerelSiparisleriGetir } from '@/src/MalzemeCekmeceleri/useMusteriSiparisleri';
import { kuryeIptalBeyaniDamgala } from '@/src/MalzemeCekmeceleri/HukukVeSozlesmeler/hukukiDelilServisi';

export async function siparisIptalEt(
  siparisKimligi: string,
  gerekceBaslik: string,
  detayNot?: string,
  iptalKaynagi: 'kurye' | 'admin' | 'mutfak' = 'admin',
  urunler?: any[],
  kuryeBilgi?: {
    kuryeId?: string;
    kuryeAdi?: string;
    kuryeTelefon?: string;
  }
): Promise<boolean> {
  const aciklamaMetni = detayNot && detayNot.trim()
    ? `Sipariş İptal Edildi (${iptalKaynagi}): ${gerekceBaslik} (${detayNot.trim()})`
    : `Sipariş İptal Edildi (${iptalKaynagi}): ${gerekceBaslik}`;

  const yerelListe = yerelSiparisleriGetir();
  const yerelEslesen = yerelListe.find(
    (s: any) => s.id === siparisKimligi || s.siparis_kodu === siparisKimligi || s.siparisKodu === siparisKimligi
  );

  let fbEslesenler: any[] = [];
  if (canliFirebaseAktifMi()) {
    try {
      const tumFbSiparisler = await koleksiyonGetir<any>('siparisler');
      fbEslesenler = (tumFbSiparisler || []).filter(
        (s: any) => s.id === siparisKimligi || s.siparis_kodu === siparisKimligi || s.siparisKodu === siparisKimligi
      );
    } catch (hata) {
      console.warn('Firebase sipariş arama hatası:', hata);
    }
  }

  const referansSiparis = fbEslesenler[0] || yerelEslesen;
  const stokDusulduMu = referansSiparis?.stok_dusuldu_mu === true;
  const iadeUrunleri = urunler || referansSiparis?.elemanlar || referansSiparis?.urunler;

  const iptalEkAlanlari = {
    asama: 'iptal',
    iptal_kaynagi: iptalKaynagi,
    iptal_gerekcesi: gerekceBaslik,
    iptal_notu: detayNot?.trim() || '',
    iptal_zamani: new Date().toISOString(),
  };

  // 1. Yerel depolama ve localStorage güncellemesi
  yerelSiparisDurumGuncelle(siparisKimligi, 'iptal', aciklamaMetni, iptalEkAlanlari);
  if (referansSiparis?.id && referansSiparis.id !== siparisKimligi) {
    yerelSiparisDurumGuncelle(referansSiparis.id, 'iptal', aciklamaMetni, iptalEkAlanlari);
  }
  if (referansSiparis?.siparis_kodu && referansSiparis.siparis_kodu !== siparisKimligi) {
    yerelSiparisDurumGuncelle(referansSiparis.siparis_kodu, 'iptal', aciklamaMetni, iptalEkAlanlari);
  }

  // Yalnızca stok_dusuldu_mu === true ise günlük porsiyonları yerel depoya da iade et
  if (stokDusulduMu && Array.isArray(iadeUrunleri) && iadeUrunleri.length > 0) {
    try {
      const { porsiyonIade } = await import('@/src/MalzemeCekmeceleri/OnSiparisVePorsiyon/PorsiyonServisi');
      iadeUrunleri.forEach((item: any) => {
        const yemekId = item.yemek_id || item.yemek?.id || item.id;
        const adet = Number(item.adet || 1);
        if (yemekId) {
          porsiyonIade(yemekId, adet);
        }
      });
    } catch (e) {
      console.warn('Stok iade hatası:', e);
    }
  }

  // 2. Canlı Firebase güncellemesi (mevcut stok_dusuldu_mu değerini ezmeden korur)
  if (canliFirebaseAktifMi()) {
    try {
      const guncellenecekVeri = {
        durum: 'iptal',
        ...iptalEkAlanlari,
        durumAciklamasi: aciklamaMetni,
        durum_aciklamasi: aciklamaMetni,
        sonGuncelleme: new Date().toLocaleTimeString('tr-TR')
      };

      if (fbEslesenler.length > 0) {
        for (const fbDoc of fbEslesenler) {
          await belgeKaydet('siparisler', fbDoc.id, guncellenecekVeri);
        }
      } else {
        await belgeKaydet('siparisler', siparisKimligi, guncellenecekVeri);
      }
    } catch (hata) {
      console.warn('Firebase sipariş iptal güncelleme hatası:', hata);
    }
  }

  // 3. Kurye kaynaklı iptalde RFC 3161 + SHA-256 zaman damgalı hukuki delil kaydı
  if (iptalKaynagi === 'kurye') {
    const damgaKod = String(referansSiparis?.siparis_kodu || referansSiparis?.siparisKodu || referansSiparis?.id || siparisKimligi);
    kuryeIptalBeyaniDamgala({
      siparisKodu: damgaKod,
      kuryeId: String(kuryeBilgi?.kuryeId || referansSiparis?.kurye_id || ''),
      kuryeAdSoyad: String(kuryeBilgi?.kuryeAdi || referansSiparis?.kurye_adi || 'Kurye'),
      kuryeTelefon: String(kuryeBilgi?.kuryeTelefon || referansSiparis?.kurye_telefon || ''),
      gerekce: gerekceBaslik,
      detayNot,
      kaynak: 'siparisler'
    }).catch((err) => {
      console.warn('Kurye iptal hukuki damga uyarısı:', err);
    });
  }

  // 4. Patron Bildirimi Ekle
  patronBildirimiEkle(
    'iade_talebi',
    'Sipariş İptal Edildi ⚠️',
    `#${(referansSiparis?.siparis_kodu || siparisKimligi).substring(0, 10)} nolu sipariş (${iptalKaynagi}) tarafından iptal edildi. Gerekçe: ${gerekceBaslik}`
  );

  // 5. Global olay tetikle
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('afyon_siparis_durum_degisti', {
        detail: {
          siparisKimligi: referansSiparis?.id || siparisKimligi,
          siparisKodu: referansSiparis?.siparis_kodu || siparisKimligi,
          durum: 'iptal',
          asama: 'iptal',
          iptal_kaynagi: iptalKaynagi
        }
      })
    );
  }

  return true;
}

