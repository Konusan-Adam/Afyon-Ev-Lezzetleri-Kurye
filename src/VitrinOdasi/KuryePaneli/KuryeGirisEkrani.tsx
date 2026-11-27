import React, { useState } from 'react';
import {
  ArrowLeft,
  Bike,
  CheckCircle2,
  Eye,
  EyeOff,
  FileText,
  KeyRound,
  Lock,
  LogIn,
  MapPin,
  Phone,
  ShieldAlert,
  ShieldCheck,
  User,
  UserPlus,
  X
} from 'lucide-react';
import { kullaniciHafizasiKullan } from '@/src/OrtakHavuz/KullaniciHafizasi';
import {
  AFYON_ILCELERI,
  KURYE_ARAC_TIPLERI,
  KURYE_GUVENLIK_SORULARI,
  kuryeGuvenlikSorusuGetir,
  kuryeSifreSifirla
} from '@/src/MalzemeCekmeceleri/KuryeTeslimat/kuryeKimlikServisi';
import { hukukiSozlesmeleriGetir } from '@/src/MalzemeCekmeceleri/HukukVeSozlesmeler/hukukDeposu';
import { useCanliSozlesmeler } from '@/src/MalzemeCekmeceleri/HukukVeSozlesmeler/useCanliSozlesmeler';

type GirisSekmesi = 'giris' | 'kayit' | 'sifre_sifirla';

const EHLIYET_SECENEKLERI = [
  'Var (A / A1 / A2 - Motosiklet Ehliyeti)',
  'Var (B Sınıfı - Otomobil / 50cc)',
  'Bisiklet / Yaya (Ehliyet Gerekmez)'
] as const;

const BELGE_BEYAN_SECENEKLERI = [
  'Temiz Sabıka Kaydı & Geçerli Trafik Sigortası / Muayene Mevcut',
  'Bisiklet / Yaya — Temiz Adli Sicil Beyanı Mevcut'
] as const;

export const KuryeGirisEkrani: React.FC = () => {
  const { kuryeOlarakGirisYap, kuryeOlarakKayitOl, yukleniyor } = kullaniciHafizasiKullan();
  const {
    sozlesmeler: dinamikSozlesmeler,
    sozlesmeHaritasi,
    yukleniyor: sozlesmelerYukleniyor,
    hata: sozlesmeHatasi
  } = useCanliSozlesmeler('kurye_basvuru');

  const [aktifSekme, setAktifSekme] = useState<GirisSekmesi>('giris');
  const [hataMesaji, setHataMesaji] = useState('');
  const [basariMesaji, setBasariMesaji] = useState('');

  // Giriş alanları
  const [girisTelefon, setGirisTelefon] = useState('');
  const [girisSifre, setGirisSifre] = useState('');
  const [girisSifreGorunur, setGirisSifreGorunur] = useState(false);

  // Kayıt alanları
  const [adSoyad, setAdSoyad] = useState('');
  const [kayitTelefon, setKayitTelefon] = useState('');
  const [kayitSifre, setKayitSifre] = useState('');
  const [kayitSifreTekrar, setKayitSifreTekrar] = useState('');
  const [kayitSifreGorunur, setKayitSifreGorunur] = useState(false);
  const [guvenlikSorusu, setGuvenlikSorusu] = useState<string>(KURYE_GUVENLIK_SORULARI[0]);
  const [guvenlikCevabi, setGuvenlikCevabi] = useState('');
  const [ilce, setIlce] = useState<string>(AFYON_ILCELERI[0]);
  const [aracTipi, setAracTipi] = useState<string>(KURYE_ARAC_TIPLERI[0]);
  const [plaka, setPlaka] = useState('');
  const [ehliyetDurumu, setEhliyetDurumu] = useState<string>(EHLIYET_SECENEKLERI[0]);
  const [belgeBeyani, setBelgeBeyani] = useState<string>(BELGE_BEYAN_SECENEKLERI[0]);

  // Dinamik Firestore sözleşme okuma & onay durumları
  const [okunanSozlesmeler, setOkunanSozlesmeler] = useState<Record<string, boolean>>({});
  const [onaylananSozlesmeler, setOnaylananSozlesmeler] = useState<Record<string, boolean>>({});
  const [okunanSozlesmeTuru, setOkunanSozlesmeTuru] = useState<string | null>(null);

  // Şifre sıfırlama alanları
  const [sifirlaTelefon, setSifirlaTelefon] = useState('');
  const [bulunanGuvenlikSorusu, setBulunanGuvenlikSorusu] = useState('');
  const [sifirlaCevap, setSifirlaCevap] = useState('');
  const [yeniSifre, setYeniSifre] = useState('');
  const [yeniSifreTekrar, setYeniSifreTekrar] = useState('');
  const [islemde, setIslemde] = useState(false);

  const aracPlakaGerekli = aracTipi === 'Motosiklet' || aracTipi === 'Otomobil';

  const sekmeDegistir = (sekme: GirisSekmesi) => {
    setAktifSekme(sekme);
    setHataMesaji('');
    setBasariMesaji('');
  };

  const handleGirisSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setHataMesaji('');
    setBasariMesaji('');
    const sonuc = await kuryeOlarakGirisYap(girisTelefon, girisSifre);
    if (!sonuc.basarili) {
      setHataMesaji(sonuc.mesaj);
    }
  };

  const zorunluSozlesmeler = dinamikSozlesmeler.filter((s) => s.zorunluMu !== false);
  const tumZorunluOnayliMi =
    !sozlesmelerYukleniyor &&
    zorunluSozlesmeler.every(
      (s) => Boolean(okunanSozlesmeler[s.tur]) && Boolean(onaylananSozlesmeler[s.tur])
    );

  const handleKayitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setHataMesaji('');
    setBasariMesaji('');

    if (kayitSifre !== kayitSifreTekrar) {
      setHataMesaji('Girdiğiniz şifreler birbiriyle eşleşmiyor.');
      return;
    }

    if (!tumZorunluOnayliMi) {
      setHataMesaji(
        'Kayıt işlemini tamamlamak için tüm zorunlu sözleşmeleri açıp okuyarak onaylamalısınız.'
      );
      return;
    }

    const onaylananListe = dinamikSozlesmeler.filter((s) =>
      Boolean(onaylananSozlesmeler[s.tur])
    );

    const sonuc = await kuryeOlarakKayitOl({
      ad_soyad: adSoyad,
      telefon: kayitTelefon,
      sifre: kayitSifre,
      guvenlik_sorusu: guvenlikSorusu,
      guvenlik_cevabi: guvenlikCevabi,
      ilce,
      arac_tipi: aracTipi,
      plaka: aracPlakaGerekli ? plaka : '',
      ehliyet_durumu: ehliyetDurumu,
      belge_beyani: belgeBeyani,
      onaylanan_sozlesmeler: onaylananListe
    });

    if (!sonuc.basarili) {
      setHataMesaji(sonuc.mesaj);
    }
  };

  const handleGuvenlikSorusuSorgula = async (e: React.FormEvent) => {
    e.preventDefault();
    setHataMesaji('');
    setBasariMesaji('');
    setIslemde(true);
    try {
      const sonuc = await kuryeGuvenlikSorusuGetir(sifirlaTelefon);
      if (!sonuc.basarili || !sonuc.soru) {
        setBulunanGuvenlikSorusu('');
        setHataMesaji(sonuc.mesaj || 'Güvenlik sorusu alınamadı.');
      } else {
        setBulunanGuvenlikSorusu(sonuc.soru);
      }
    } finally {
      setIslemde(false);
    }
  };

  const handleSifreSifirlaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setHataMesaji('');
    setBasariMesaji('');

    if (yeniSifre !== yeniSifreTekrar) {
      setHataMesaji('Yeni şifreler birbiriyle eşleşmiyor.');
      return;
    }

    setIslemde(true);
    try {
      const sonuc = await kuryeSifreSifirla({
        telefon: sifirlaTelefon,
        guvenlikCevabi: sifirlaCevap,
        yeniSifre
      });
      if (!sonuc.basarili) {
        setHataMesaji(sonuc.mesaj);
      } else {
        setBasariMesaji(sonuc.mesaj);
        setGirisTelefon(sifirlaTelefon);
        setBulunanGuvenlikSorusu('');
        setSifirlaCevap('');
        setYeniSifre('');
        setYeniSifreTekrar('');
        setAktifSekme('giris');
      }
    } finally {
      setIslemde(false);
    }
  };

  const sozlesmeMetniniAc = (tur: string) => {
    setOkunanSozlesmeler((onceki) => ({ ...onceki, [tur]: true }));
    setOkunanSozlesmeTuru(tur);
  };

  const okunanSozlesme = okunanSozlesmeTuru
    ? sozlesmeHaritasi[okunanSozlesmeTuru] || hukukiSozlesmeleriGetir()[okunanSozlesmeTuru] || null
    : null;

  const okunanSozlesmeyiOnayla = () => {
    if (!okunanSozlesmeTuru) return;
    const tur = okunanSozlesmeTuru;
    setOkunanSozlesmeler((onceki) => ({ ...onceki, [tur]: true }));
    setOnaylananSozlesmeler((onceki) => ({ ...onceki, [tur]: true }));
    setOkunanSozlesmeTuru(null);
  };

  return (
    <div className="min-h-screen bg-[#0C020E] text-gray-100 font-sans flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-lg bg-[#180A1F] border border-[#4B1D55] rounded-3xl shadow-2xl shadow-black/80 overflow-hidden">
        {/* Üst Kurumsal Başlık */}
        <div className="bg-gradient-to-r from-[#2D0E36] via-[#41154E] to-[#240B2C] border-b border-[#4B1D55] px-5 py-5 flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-amber-500 p-0.5 shadow-lg shrink-0">
            <div className="w-full h-full rounded-[14px] bg-[#180A1F] flex items-center justify-center">
              <Bike className="w-6 h-6 text-amber-400" />
            </div>
          </div>
          <div className="min-w-0">
            <h1 className="font-sans font-black text-base sm:text-lg text-white tracking-tight">
              Afyon Ev Lezzetleri — Kurye Paneli
            </h1>
            <p className="text-xs text-purple-200/80 mt-0.5">
              Yalnızca yetkili kurye personeli girişi ve zaman damgalı kurye başvurusu
            </p>
          </div>
        </div>

        {/* Sekme Anahtarı: Yalnızca Giriş Yap ve Kurye Kaydı */}
        <div className="p-3 bg-[#120616] border-b border-[#3E1646] grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => sekmeDegistir('giris')}
            className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              aktifSekme === 'giris' || aktifSekme === 'sifre_sifirla'
                ? 'bg-gradient-to-r from-[#6D237A] to-[#4E1659] text-white border border-amber-400/40 shadow'
                : 'text-purple-200/75 hover:text-white hover:bg-[#240B2C]'
            }`}
          >
            <LogIn className="w-3.5 h-3.5 text-amber-300" />
            <span>Giriş Yap</span>
          </button>

          <button
            type="button"
            onClick={() => sekmeDegistir('kayit')}
            className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              aktifSekme === 'kayit'
                ? 'bg-gradient-to-r from-[#6D237A] to-[#4E1659] text-white border border-amber-400/40 shadow'
                : 'text-purple-200/75 hover:text-white hover:bg-[#240B2C]'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5 text-emerald-300" />
            <span>Kurye Kaydı</span>
          </button>
        </div>

        {/* Form Gövdesi */}
        <div className="p-5 sm:p-6 space-y-4">
          {hataMesaji && (
            <div className="p-3 rounded-2xl bg-rose-950/75 border border-rose-500/50 text-rose-200 text-xs font-semibold flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{hataMesaji}</span>
            </div>
          )}

          {basariMesaji && (
            <div className="p-3 rounded-2xl bg-emerald-950/75 border border-emerald-500/50 text-emerald-200 text-xs font-semibold flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{basariMesaji}</span>
            </div>
          )}

          {/* SEKME 1: KURYE GİRİŞİ */}
          {aktifSekme === 'giris' && (
            <form onSubmit={handleGirisSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-purple-200">Cep Telefonu</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-amber-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    required
                    value={girisTelefon}
                    onChange={(e) => setGirisTelefon(e.target.value)}
                    placeholder="05XX XXX XX XX"
                    className="w-full bg-[#110415] border border-[#4B1D55] focus:border-amber-400 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-purple-300/40 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-purple-200">Şifre</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-amber-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={girisSifreGorunur ? 'text' : 'password'}
                    required
                    value={girisSifre}
                    onChange={(e) => setGirisSifre(e.target.value)}
                    placeholder="Kurye şifreniz"
                    className="w-full bg-[#110415] border border-[#4B1D55] focus:border-amber-400 rounded-xl pl-10 pr-11 py-2.5 text-sm text-white placeholder-purple-300/40 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setGirisSifreGorunur((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-300 hover:text-white cursor-pointer"
                  >
                    {girisSifreGorunur ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={yukleniyor}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-[#180A1F] font-black text-sm shadow-lg shadow-amber-500/20 cursor-pointer disabled:opacity-50 transition-all"
              >
                {yukleniyor ? 'Kontrol Ediliyor...' : 'Kurye Paneline Giriş Yap'}
              </button>

              <div className="flex items-center justify-between text-[11px] text-purple-300/80 pt-1">
                <button
                  type="button"
                  onClick={() => sekmeDegistir('sifre_sifirla')}
                  className="hover:text-amber-300 underline cursor-pointer"
                >
                  Şifremi unuttum
                </button>
                <button
                  type="button"
                  onClick={() => sekmeDegistir('kayit')}
                  className="hover:text-emerald-300 font-semibold cursor-pointer"
                >
                  Yeni kurye başvurusu yap →
                </button>
              </div>
            </form>
          )}

          {/* SEKME 2: KURYE KENDİ KENDİNE KAYIT */}
          {aktifSekme === 'kayit' && (
            <form onSubmit={handleKayitSubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold text-purple-200">Ad Soyad</label>
                  <div className="relative">
                    <User className="w-3.5 h-3.5 text-amber-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={adSoyad}
                      onChange={(e) => setAdSoyad(e.target.value)}
                      placeholder="Adınız Soyadınız"
                      className="w-full bg-[#110415] border border-[#4B1D55] focus:border-amber-400 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-purple-300/40 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-purple-200">Cep Telefonu</label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-amber-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      required
                      value={kayitTelefon}
                      onChange={(e) => setKayitTelefon(e.target.value)}
                      placeholder="05XX XXX XX XX"
                      className="w-full bg-[#110415] border border-[#4B1D55] focus:border-amber-400 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-purple-300/40 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold text-purple-200">Şifre (En az 6 karakter)</label>
                  <div className="relative">
                    <Lock className="w-3.5 h-3.5 text-amber-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={kayitSifreGorunur ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={kayitSifre}
                      onChange={(e) => setKayitSifre(e.target.value)}
                      placeholder="Şifre belirleyin"
                      className="w-full bg-[#110415] border border-[#4B1D55] focus:border-amber-400 rounded-xl pl-9 pr-9 py-2 text-xs text-white placeholder-purple-300/40 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setKayitSifreGorunur((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-purple-300 hover:text-white cursor-pointer"
                    >
                      {kayitSifreGorunur ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-purple-200">Şifre Tekrar</label>
                  <input
                    type={kayitSifreGorunur ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={kayitSifreTekrar}
                    onChange={(e) => setKayitSifreTekrar(e.target.value)}
                    placeholder="Şifreyi doğrulayın"
                    className="w-full bg-[#110415] border border-[#4B1D55] focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-white placeholder-purple-300/40 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold text-purple-200">Çalışma Bölgesi / İlçe</label>
                  <div className="relative">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <select
                      value={ilce}
                      onChange={(e) => setIlce(e.target.value)}
                      className="w-full bg-[#110415] border border-[#4B1D55] focus:border-amber-400 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none cursor-pointer"
                    >
                      {AFYON_ILCELERI.map((ilc) => (
                        <option key={ilc} value={ilc}>
                          {ilc}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-purple-200">Araç Tipi</label>
                  <select
                    value={aracTipi}
                    onChange={(e) => setAracTipi(e.target.value)}
                    className="w-full bg-[#110415] border border-[#4B1D55] focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-white focus:outline-none cursor-pointer"
                  >
                    {KURYE_ARAC_TIPLERI.map((tip) => (
                      <option key={tip} value={tip}>
                        {tip}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {aracPlakaGerekli && (
                <div className="space-y-1">
                  <label className="block font-bold text-purple-200">Araç Plakası (Zorunlu)</label>
                  <input
                    type="text"
                    required
                    value={plaka}
                    onChange={(e) => setPlaka(e.target.value.toUpperCase())}
                    placeholder="Örn: 03 AFY 123"
                    className="w-full bg-[#110415] border border-[#4B1D55] focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-white font-mono uppercase placeholder-purple-300/40 focus:outline-none"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold text-purple-200">Ehliyet Durumu</label>
                  <select
                    value={ehliyetDurumu}
                    onChange={(e) => setEhliyetDurumu(e.target.value)}
                    className="w-full bg-[#110415] border border-[#4B1D55] focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-white focus:outline-none cursor-pointer"
                  >
                    {EHLIYET_SECENEKLERI.map((eSec) => (
                      <option key={eSec} value={eSec}>
                        {eSec}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-purple-200">Sabıka / Belge Beyanı</label>
                  <select
                    value={belgeBeyani}
                    onChange={(e) => setBelgeBeyani(e.target.value)}
                    className="w-full bg-[#110415] border border-[#4B1D55] focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-white focus:outline-none cursor-pointer"
                  >
                    {BELGE_BEYAN_SECENEKLERI.map((bSec) => (
                      <option key={bSec} value={bSec}>
                        {bSec}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold text-purple-200">Güvenlik Sorusu</label>
                  <select
                    value={guvenlikSorusu}
                    onChange={(e) => setGuvenlikSorusu(e.target.value)}
                    className="w-full bg-[#110415] border border-[#4B1D55] focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-white focus:outline-none cursor-pointer"
                  >
                    {KURYE_GUVENLIK_SORULARI.map((soru) => (
                      <option key={soru} value={soru}>
                        {soru}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-purple-200">Güvenlik Cevabı</label>
                  <input
                    type="text"
                    required
                    value={guvenlikCevabi}
                    onChange={(e) => setGuvenlikCevabi(e.target.value)}
                    placeholder="Şifre sıfırlama cevabınız"
                    className="w-full bg-[#110415] border border-[#4B1D55] focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-white placeholder-purple-300/40 focus:outline-none"
                  />
                </div>
              </div>

              {/* Dinamik Firestore Sözleşme Onayları + Oku Modalları */}
              <div className="p-3.5 rounded-2xl bg-[#110415] border border-[#4B1D55] space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-300">
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <span>Yasal Sözleşmeler (RFC 3161 + SHA-256 Zaman Damgalı)</span>
                  </div>
                  <span className="text-[10px] text-purple-300/75">
                    {dinamikSozlesmeler.length} aktif belge
                  </span>
                </div>

                {sozlesmelerYukleniyor ? (
                  <div className="py-3 text-center text-[11px] text-purple-200/75">
                    Sözleşmeler Firestore üzerinden canlı yükleniyor...
                  </div>
                ) : dinamikSozlesmeler.length === 0 ? (
                  <div className="py-2.5 px-3 rounded-xl bg-[#1A0821] border border-[#3E1646] text-[11px] text-purple-200/80">
                    {sozlesmeHatasi ||
                      'Şu anda kurye başvurusu için tanımlı aktif sözleşme bulunmuyor.'}
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {dinamikSozlesmeler.map((sozlesme) => {
                      const okundu = Boolean(okunanSozlesmeler[sozlesme.tur]);
                      const onayli = Boolean(onaylananSozlesmeler[sozlesme.tur]);
                      return (
                        <div
                          key={sozlesme.tur}
                          className="flex items-start justify-between gap-2 p-2 rounded-xl bg-[#180A1F]/80 border border-[#3E1646]"
                        >
                          <label className="flex items-start gap-2 cursor-pointer text-[11px] text-purple-100 leading-snug flex-1">
                            <input
                              type="checkbox"
                              checked={onayli}
                              onChange={(e) => {
                                if (!okundu) {
                                  sozlesmeMetniniAc(sozlesme.tur);
                                  return;
                                }
                                setOnaylananSozlesmeler((onceki) => ({
                                  ...onceki,
                                  [sozlesme.tur]: e.target.checked
                                }));
                              }}
                              className="accent-amber-500 w-4 h-4 mt-0.5 shrink-0"
                            />
                            <span>
                              <span className="font-semibold text-white">
                                {sozlesme.baslik}
                              </span>{' '}
                              {sozlesme.zorunluMu !== false ? (
                                <span className="text-amber-300 font-bold">(Zorunlu)</span>
                              ) : (
                                <span className="text-purple-300/70">(İsteğe Bağlı)</span>
                              )}
                              {!okundu && (
                                <span className="block text-[10px] text-amber-300/85 mt-0.5">
                                  Onaylamak için önce &ldquo;Oku&rdquo; butonundan metni açınız.
                                </span>
                              )}
                            </span>
                          </label>

                          <button
                            type="button"
                            onClick={() => sozlesmeMetniniAc(sozlesme.tur)}
                            className={`px-2.5 py-1 rounded-lg font-bold text-[10px] border shrink-0 cursor-pointer transition-colors ${
                              okundu
                                ? 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40'
                                : 'bg-[#2A0E33] hover:bg-[#3A1447] text-amber-300 border-[#562163]'
                            }`}
                          >
                            {okundu ? 'Okundu ✓' : 'Oku'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={yukleniyor || sozlesmelerYukleniyor || !tumZorunluOnayliMi}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 text-white font-black text-sm shadow-lg shadow-emerald-600/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {yukleniyor
                  ? 'Başvuru ve Zaman Damgası Oluşturuluyor...'
                  : 'Kurye Başvurusunu Tamamla & Damgala'}
              </button>
            </form>
          )}

          {/* ŞİFREMİ UNUTTUM / ŞİFRE SIFIRLAMA (Yalnızca linkten açılır) */}
          {aktifSekme === 'sifre_sifirla' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-[#3E1646] pb-3">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-amber-300" />
                  <h2 className="text-sm font-extrabold text-white">Kurye Şifre Sıfırlama</h2>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setBulunanGuvenlikSorusu('');
                    sekmeDegistir('giris');
                  }}
                  className="inline-flex items-center gap-1 text-xs font-bold text-purple-200 hover:text-amber-300 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Girişe Dön</span>
                </button>
              </div>

              {!bulunanGuvenlikSorusu ? (
                <form onSubmit={handleGuvenlikSorusuSorgula} className="space-y-3.5">
                  <p className="text-xs text-purple-200/80 leading-relaxed">
                    Kurye hesabınıza kayıtlı cep telefonu numaranızı girerek güvenlik sorunuzu doğrulayın.
                    (5 dakikada en fazla 5 hatalı deneme sınırı uygulanır.)
                  </p>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-purple-200">Kayıtlı Cep Telefonu</label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-amber-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="tel"
                        required
                        value={sifirlaTelefon}
                        onChange={(e) => setSifirlaTelefon(e.target.value)}
                        placeholder="05XX XXX XX XX"
                        className="w-full bg-[#110415] border border-[#4B1D55] focus:border-amber-400 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-purple-300/40 focus:outline-none"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={islemde}
                    className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-[#180A1F] font-black text-xs cursor-pointer disabled:opacity-50 transition-all"
                  >
                    {islemde ? 'Sorgulanıyor...' : 'Güvenlik Sorusunu Getir'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleSifreSifirlaSubmit} className="space-y-3.5">
                  <div className="p-3 rounded-xl bg-[#110415] border border-amber-500/30 space-y-1">
                    <span className="text-[11px] font-bold text-amber-300">Güvenlik Sorunuz:</span>
                    <p className="text-xs text-white font-semibold">{bulunanGuvenlikSorusu}</p>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-purple-200">Güvenlik Cevabı</label>
                    <input
                      type="text"
                      required
                      value={sifirlaCevap}
                      onChange={(e) => setSifirlaCevap(e.target.value)}
                      placeholder="Cevabınızı giriniz"
                      className="w-full bg-[#110415] border border-[#4B1D55] focus:border-amber-400 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-purple-200">Yeni Şifre</label>
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={yeniSifre}
                        onChange={(e) => setYeniSifre(e.target.value)}
                        placeholder="En az 6 karakter"
                        className="w-full bg-[#110415] border border-[#4B1D55] focus:border-amber-400 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-purple-200">Yeni Şifre Tekrar</label>
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={yeniSifreTekrar}
                        onChange={(e) => setYeniSifreTekrar(e.target.value)}
                        placeholder="Şifreyi tekrarlayın"
                        className="w-full bg-[#110415] border border-[#4B1D55] focus:border-amber-400 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setBulunanGuvenlikSorusu('');
                        setHataMesaji('');
                      }}
                      className="py-2.5 px-4 rounded-xl bg-[#260E2A] hover:bg-[#321238] border border-[#4B1D55] text-purple-100 text-xs font-bold cursor-pointer"
                    >
                      Geri
                    </button>
                    <button
                      type="submit"
                      disabled={islemde}
                      className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 text-white font-black text-xs cursor-pointer disabled:opacity-50"
                    >
                      {islemde ? 'Güncelleniyor...' : 'Şifremi Güncelle'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Sözleşme Metni Okuma Modalı */}
      {okunanSozlesme && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="w-full max-w-xl bg-[#180A1F] border-2 border-[#4B1D55] rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            <div className="px-5 py-4 bg-[#260B2E] border-b border-purple-800/60 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="w-4 h-4 text-amber-400 shrink-0" />
                <h2 className="font-sans font-bold text-sm text-white truncate">
                  {okunanSozlesme.baslik}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOkunanSozlesmeTuru(null)}
                className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-purple-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto">
              <div className="text-[11px] text-purple-300 font-mono mb-2">
                Sürüm: v{okunanSozlesme.versiyon} • Güncelleme: {okunanSozlesme.guncellenmeTarihi}
              </div>
              <pre className="whitespace-pre-wrap font-sans text-xs text-purple-100 leading-relaxed bg-[#110415] p-4 rounded-2xl border border-[#3E1646]">
                {okunanSozlesme.icerik}
              </pre>
            </div>

            <div className="px-5 py-3.5 bg-[#120616] border-t border-[#3E1646] flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOkunanSozlesmeTuru(null)}
                className="py-2 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-purple-100 cursor-pointer"
              >
                Kapat
              </button>
              <button
                type="button"
                onClick={okunanSozlesmeyiOnayla}
                className="py-2 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-[#180A1F] text-xs font-black cursor-pointer"
              >
                Okudum ve Onayla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
