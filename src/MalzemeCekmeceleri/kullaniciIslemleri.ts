import { Kullanici } from '@/src/veritabani/VeriTipleri';
import { canliFirebaseAktifMi } from '@/src/veritabani/FirebaseIstemcisi';
import { belgeKaydet, koleksiyonGetir } from '@/src/veritabani/FirebaseKoleksiyonServisi';
import { telefonGecerliMi } from '@/src/MalzemeCekmeceleri/Dogrulama/telefonDogrulayici';
import { patronBildirimiEkle } from '@/src/MalzemeCekmeceleri/PatronBildirimServisi';
import { kuryeKayitSozlesmeleriniDamgala } from '@/src/MalzemeCekmeceleri/HukukVeSozlesmeler/hukukiDelilServisi';
import { kuryeGirisYap } from '@/src/MalzemeCekmeceleri/KuryeTeslimat/kuryeKimlikServisi';

function telefonTemizle(tel: string): string {
  const rakamlar = tel.replace(/\D/g, '');
  if (rakamlar.startsWith('90') && rakamlar.length === 12) {
    return rakamlar.substring(2);
  }
  if (rakamlar.startsWith('0') && rakamlar.length === 11) {
    return rakamlar.substring(1);
  }
  return rakamlar;
}

export async function veritabaninaKullaniciKaydet(
  yeniKullanici: Omit<Kullanici, 'kimlik' | 'onayli_mi' | 'olusturma_tarihi'> & { sifre?: string }
): Promise<Kullanici | null> {
  if (yeniKullanici.rol !== 'kurye') {
    console.warn('Bu panel yalnızca yetkili kurye personeli içindir.');
    return null;
  }

  const dogrulama = telefonGecerliMi(yeniKullanici.telefon);
  if (!dogrulama.gecerli) {
    console.warn('Geçersiz telefon numarası ile kayıt reddedildi:', yeniKullanici.telefon);
    return null;
  }

  const standartTelefon = telefonTemizle(yeniKullanici.telefon);

  if (canliFirebaseAktifMi()) {
    try {
      const mevcutlar = await koleksiyonGetir<any>('kullanicilar');
      const kayitli = mevcutlar.find((k) => telefonTemizle(k.telefon || '') === standartTelefon);
      if (kayitli) {
        console.warn('Bu telefon numarası ile zaten kayıtlı bir kullanıcı var:', standartTelefon);
        return null;
      }
    } catch {
      // Yoksay
    }
  }

  const temizSifre = String(yeniKullanici.sifre || '').trim();
  if (temizSifre.length < 6) {
    return null;
  }

  const duzgunTelefon = standartTelefon.startsWith('0') ? standartTelefon : `0${standartTelefon}`;
  const kimlikId = standartTelefon ? `tel_${duzgunTelefon}` : `usr_${Date.now()}`;

  const kullaniciKaydi: any = {
    id: kimlikId,
    kimlik: kimlikId,
    ad_soyad: yeniKullanici.ad_soyad ? yeniKullanici.ad_soyad.trim() : 'İsimsiz',
    telefon: duzgunTelefon,
    eposta: (yeniKullanici as any).eposta || '',
    rol: 'kurye',
    isletme_adi: '',
    arac_tipi: yeniKullanici.arac_tipi || '',
    plaka: yeniKullanici.plaka || '',
    ilce: yeniKullanici.ilce || 'Merkez',
    onayli_mi: false,
    onay_durumu: 'beklemede',
    askida_mi: false,
    olusturma_tarihi: new Date().toISOString()
  };

  patronBildirimiEkle(
    'yeni_kurye',
    'Yeni Kurye Başvurusu 🛵',
    `${kullaniciKaydi.ad_soyad} kurye olmak için başvurdu. Onay bekliyor.`,
    kimlikId
  );

  kuryeKayitSozlesmeleriniDamgala({
    kullaniciKimlik: kimlikId,
    kullaniciTelefon: duzgunTelefon,
    kullaniciAdSoyad: kullaniciKaydi.ad_soyad,
    ekDetay: {
      aracTipi: kullaniciKaydi.arac_tipi,
      ilce: kullaniciKaydi.ilce
    }
  }).catch((err) => {
    console.warn('Kurye kayıt hukuki damga uyarısı:', err);
  });

  if (canliFirebaseAktifMi()) {
    try {
      await belgeKaydet('kullanicilar', kimlikId, kullaniciKaydi);
    } catch (hata) {
      console.warn('Firebase kurye kayıt hatası:', hata);
    }
  }

  return kullaniciKaydi;
}

export async function veritabanindanKullaniciGirisYaptir(
  telefon: string,
  sifre: string
): Promise<Kullanici | null> {
  const sonuc = await kuryeGirisYap(telefon, sifre);
  return sonuc.basarili && sonuc.kullanici ? sonuc.kullanici : null;
}
