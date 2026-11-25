import React, { useEffect, useRef, useState } from 'react';
import {
  Bike,
  CheckCircle2,
  ShieldCheck,
  Power,
  ArrowLeft,
  LogOut,
  MoreVertical,
  BatteryCharging
} from 'lucide-react';
import { kullaniciHafizasiKullan } from '@/src/OrtakHavuz/KullaniciHafizasi';
import { KuryeCuzdanSekmesi } from './KuryeCuzdanSekmesi';
import { KuryeQrTarayiciModali } from '../Bilesenler/QrTeslimat/KuryeQrTarayiciModali';
import { KuryeHaritaModali } from '../Bilesenler/KuryeTeslimat/KuryeHaritaModali';
import { useKuryeCanliPaketler } from '@/src/MalzemeCekmeceleri/KuryeTeslimat/useKuryeCanliPaketler';
import { useKuryeSubeSiparisleri } from '@/src/MalzemeCekmeceleri/KuryeTeslimat/useKuryeSubeSiparisleri';
import { KuryePaketKarti } from '../Bilesenler/KuryeTeslimat/KuryePaketKarti';
import { SubeSiparisKarti } from '../Bilesenler/KuryeTeslimat/SubeSiparisKarti';
import { KuryeSozlesmeOnayModali } from '../Bilesenler/KuryeTeslimat/KuryeSozlesmeOnayModali';
import { KuryeAltMenu, type KuryeSekmeTipi } from '../Bilesenler/KuryeTeslimat/KuryeAltMenu';
import { ApkGuncellemeUyarisi } from '../Bilesenler/KuryeTeslimat/ApkGuncellemeUyarisi';
import { useKuryeKonumYayini } from '@/src/MalzemeCekmeceleri/KuryeTeslimat/useKuryeKonumYayini';
import { useKuryeBildirimleri } from '@/src/MalzemeCekmeceleri/KuryeTeslimat/useKuryeBildirimleri';
import { KuryeYeniPaketUyarisi } from '../Bilesenler/KuryeTeslimat/KuryeYeniPaketUyarisi';
import { TezgahBildirimCubugu } from '../Bilesenler/TezgahBildirimCubugu';
import { kuryeZiliCal } from '@/src/MalzemeCekmeceleri/KuryeTeslimat/KuryeZilServisi';
import {
  androidOrtamiMi,
  androidOturumKaydet,
  androidOturumTemizle,
  androidPilMuafiyetiIste,
  androidPilMuafiyetiVarMi
} from '@/src/MalzemeCekmeceleri/AndroidKopru/AndroidKopruServisi';
import { useApkGuncelleme } from '@/src/MalzemeCekmeceleri/AndroidKopru/useApkGuncelleme';

export const KuryePaneli: React.FC = () => {
  const { aktifKullanici, panelDegistir, cikisYap } = kullaniciHafizasiKullan();
  const [gorevde, setGorevde] = useState(true);
  const [aktifSekme, setAktifSekme] = useState<KuryeSekmeTipi>('aktif_paketler');
  const [qrTaramaAcik, setQrTaramaAcik] = useState(false);
  const [seciliSiparisKodu, setSeciliSiparisKodu] = useState('');
  const [haritaPaket, setHaritaPaket] = useState<any | null>(null);
  const [sozlesmeModaliAcik, setSozlesmeModaliAcik] = useState(false);
  const [mobilMenuAcik, setMobilMenuAcik] = useState(false);
  const [bilgiMesaji, setBilgiMesaji] = useState('');
  const mobilMenuRef = useRef<HTMLDivElement | null>(null);

  const kuryeId = aktifKullanici?.kimlik || aktifKullanici?.id || 'kurye-1';
  const kuryeAdi = aktifKullanici?.ad_soyad || 'Kurye';
  const kuryeTelefon = aktifKullanici?.telefon || '';
  const androidIcinde = androidOrtamiMi();
  const [pilMuafiyetiVar, setPilMuafiyetiVar] = useState<boolean>(() =>
    androidIcinde ? androidPilMuafiyetiVarMi() : true
  );

  const {
    guncellemeVar,
    yeniSurumBilgisi,
    indiriliyor: apkIndiriliyor,
    hataMesaji: apkHataMesaji,
    simdiGuncelle,
    uyariyiKapat: guncellemeUyariKapat
  } = useApkGuncelleme();

  // Android native arka plan dinleyici servisine kurye kimliğini aktar
  useEffect(() => {
    if (androidIcinde && kuryeId) {
      androidOturumKaydet(kuryeId, kuryeAdi);
    }
  }, [androidIcinde, kuryeId, kuryeAdi]);

  // Dışarı tıklanınca mobil aksiyon menüsünü kapat
  useEffect(() => {
    if (!mobilMenuAcik) return;
    const disariTiklandi = (e: MouseEvent) => {
      if (mobilMenuRef.current && !mobilMenuRef.current.contains(e.target as Node)) {
        setMobilMenuAcik(false);
      }
    };
    document.addEventListener('mousedown', disariTiklandi);
    return () => document.removeEventListener('mousedown', disariTiklandi);
  }, [mobilMenuAcik]);

  // 🔔 Kurye Dağıtım & Paket Var Canlı Dedektörü
  const { yeniPaketUyarisi, uyariKapat } = useKuryeBildirimleri(kuryeId);

  const { aktifPaketler, teslimEdilenler, paketiAl, paketiTeslimAldiBildir, teslimEt, paketiIptalEt } = useKuryeCanliPaketler(
    kuryeId,
    kuryeAdi,
    kuryeTelefon
  );

  const {
    aktifSubeSiparisleri,
    teslimEdilenSubeSiparisleri,
    kabulEt: subeKabulEt,
    teslimAl: subeTeslimAl,
    teslimEt: subeTeslimEt
  } = useKuryeSubeSiparisleri(kuryeId, kuryeAdi, kuryeTelefon);

  const aktifPaketIdleri = [
    ...aktifPaketler.map(p => p.id || p.siparis_kodu || p.siparisKodu),
    ...aktifSubeSiparisleri
      .filter((s) => s.kurye_id === kuryeId)
      .map((s) => s.id)
  ];
  const { yayinAktif, sonKonum } = useKuryeKonumYayini({
    kuryeId,
    kuryeAdi,
    telefon: kuryeTelefon,
    aracTipi: aktifKullanici?.arac_tipi,
    plaka: aktifKullanici?.plaka,
    gorevde,
    aktifPaketIdleri
  });

  const toplamAktifGorevSayisi = aktifPaketler.length + aktifSubeSiparisleri.length;
  const tumTeslimEdilenler = [...teslimEdilenSubeSiparisleri, ...teslimEdilenler];

  const mesajGoster = (mesaj: string) => {
    setBilgiMesaji(mesaj);
    setTimeout(() => setBilgiMesaji(''), 4000);
  };

  const paketAlVeBildir = async (id: string, tahminiDakika: number = 15) => {
    const sonuc = await paketiAl(id, tahminiDakika);
    mesajGoster(sonuc.mesaj);
  };

  const teslimEtVeBildir = async (
    kod: string,
    pin: string,
    dogrulamaYontemi?: 'pin' | 'qr'
  ) => {
    const sonuc = await teslimEt(kod, pin, dogrulamaYontemi);
    mesajGoster(sonuc.mesaj);
    return sonuc;
  };

  const paketIptalEtVeBildir = async (id: string, gerekce: string, detayNot?: string) => {
    const sonuc = await paketiIptalEt(id, gerekce, detayNot);
    mesajGoster(sonuc.mesaj);
    return sonuc;
  };

  const subeKabulEtVeBildir = async (siparisId: string) => {
    const sonuc = await subeKabulEt(siparisId);
    mesajGoster(sonuc.mesaj);
    return sonuc;
  };

  const subeTeslimAlVeBildir = async (siparisId: string, girilenPin?: string) => {
    const sonuc = await subeTeslimAl(siparisId, girilenPin);
    mesajGoster(sonuc.mesaj);
    return sonuc;
  };

  const subeTeslimEtVeBildir = async (siparisId: string) => {
    const sonuc = await subeTeslimEt(siparisId);
    mesajGoster(sonuc.mesaj);
    return sonuc;
  };

  return (
    <div className="w-full min-h-screen bg-[#0C020E] text-gray-100 font-sans select-none pb-28">
      
      {/* 🔔 YENİ PAKET HAZIR CANLI FLAŞ BİLDİRİMİ & KORNA ALARMI */}
      <KuryeYeniPaketUyarisi 
        uyari={yeniPaketUyarisi} 
        onKapat={uyariKapat} 
        onPaketAl={paketAlVeBildir} 
      />

      {/* 👑 PATRON TEST GEÇİŞ BANNERI (Yalnızca Patron/Yönetici İse Görünür) */}
      {aktifKullanici?.rol === 'yonetici' && (
        <div className="bg-gradient-to-r from-amber-700/90 via-[#4B1659] to-amber-700/90 border-b border-amber-400/30 text-white px-4 py-2 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <ShieldCheck className="w-4 h-4 text-amber-300 shrink-0" />
            <span className="font-bold truncate">Kurye Masası (Patron Önizleme)</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => panelDegistir('vitrin')}
              className="bg-black/45 hover:bg-black/70 px-2.5 py-1 rounded-lg text-white font-bold border border-white/20 text-[11px] cursor-pointer transition-all"
            >
              Vitrin
            </button>
            <button
              type="button"
              onClick={() => panelDegistir('patron')}
              className="bg-black/45 hover:bg-black/70 px-2.5 py-1 rounded-lg text-amber-300 font-bold border border-amber-400/40 text-[11px] cursor-pointer transition-all"
            >
              Patron
            </button>
          </div>
        </div>
      )}

      {/* Üst Başlık Barı — Resmi Mor/Altın Kimlik, Tek Satır Sade Tasarım */}
      <header className="sticky top-0 z-30 bg-[#140519]/95 backdrop-blur-md border-b border-[#3E1646] px-3 sm:px-4 py-3">
        <div className="anasayfa-genislik flex items-center justify-between gap-2.5">
          
          {/* Sol: Geri + Kurye İkonu + İsim & Tam Bilgi */}
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <button
              type="button"
              onClick={() => panelDegistir('vitrin')}
              className="w-9 h-9 rounded-xl bg-[#240B2C] hover:bg-[#34123F] text-purple-200 hover:text-white border border-[#4D1E57] flex items-center justify-center transition-all cursor-pointer shrink-0"
              title="Vitrini Aç"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <div className="hidden sm:flex w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-[#6D237A] items-center justify-center text-white shadow-md shrink-0">
              <Bike className="w-4 h-4 text-white" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h1 className="font-sans font-extrabold text-sm sm:text-base text-white leading-tight truncate">
                  {aktifKullanici?.ad_soyad || 'Kurye Personeli'}
                </h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shrink-0">
                  {aktifKullanici?.arac_tipi || 'Motorlu Kurye'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-purple-200/80 mt-0.5 flex-wrap">
                <span>{aktifKullanici?.ilce ? `${aktifKullanici.ilce}` : 'Afyonkarahisar'}</span>
                <span className="text-purple-500">•</span>
                <span>{aktifKullanici?.plaka ? `Plaka: ${aktifKullanici.plaka}` : 'Plaka Yok'}</span>
                {gorevde && (
                  <>
                    <span className="text-purple-500">•</span>
                    <span className="inline-flex items-center gap-1 text-emerald-300 font-semibold">
                      <span className={`w-1.5 h-1.5 rounded-full ${yayinAktif ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`} />
                      <span>{yayinAktif ? 'GPS Açık' : 'GPS Aranıyor'}</span>
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Sağ: Görevde / Molada Anahtarı + İkincil Araçlar */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setGorevde(!gorevde)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer border ${
                gorevde
                  ? 'bg-emerald-950/80 hover:bg-emerald-900/80 border-emerald-500/70 text-emerald-300 shadow-sm shadow-emerald-950/50'
                  : 'bg-amber-950/70 hover:bg-amber-900/70 border-amber-500/60 text-amber-300'
              }`}
            >
              <Power className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden md:inline">{gorevde ? 'Görevde (Paket Alabilir)' : 'Molada (Pasif)'}</span>
              <span className="md:hidden">{gorevde ? 'Görevde' : 'Molada'}</span>
            </button>

            {/* Masaüstü Araçları */}
            <div className="hidden md:flex items-center gap-2">
              <TezgahBildirimCubugu
                panelTuru="kurye"
                onSesTesti={() => kuryeZiliCal('Korna Testi 🛵', 'Kurye arka plan paketi uyarısı hazır.')}
              />

              <button
                type="button"
                onClick={() => setSozlesmeModaliAcik(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#240B2C] hover:bg-[#34123F] border border-[#4D1E57] text-amber-300 text-xs font-bold transition-all cursor-pointer"
                title="Kurye Taşıma Sözleşmesi ve KVKK Onayı"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Sözleşme</span>
              </button>

              {androidIcinde && !pilMuafiyetiVar && (
                <button
                  type="button"
                  onClick={() => {
                    androidPilMuafiyetiIste();
                    setTimeout(() => setPilMuafiyetiVar(androidPilMuafiyetiVarMi()), 1500);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-950/60 hover:bg-amber-900/70 border border-amber-500/50 text-amber-300 text-xs font-bold transition-all cursor-pointer"
                  title="Arka plan bildirimlerinin kesilmemesi için pil kısıtlamasını kaldır"
                >
                  <BatteryCharging className="w-3.5 h-3.5" />
                  <span>Pil İzni</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  androidOturumTemizle();
                  cikisYap();
                  panelDegistir('vitrin');
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 border border-rose-800/60 text-rose-300 text-xs font-bold transition-all cursor-pointer"
                title="Güvenli Çıkış Yap"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Çıkış</span>
              </button>
            </div>

            {/* Mobil Kompakt İşlem Menüsü (Başlığı kalabalıklaştırmaz) */}
            <div className="relative md:hidden" ref={mobilMenuRef}>
              <button
                type="button"
                onClick={() => setMobilMenuAcik((prev) => !prev)}
                className="w-9 h-9 rounded-xl bg-[#240B2C] hover:bg-[#34123F] border border-[#4D1E57] text-purple-200 flex items-center justify-center cursor-pointer transition-all"
                title="Kurye Araçları"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {mobilMenuAcik && (
                <div className="absolute right-0 mt-2 w-52 bg-[#1D0A20] border border-[#4D1E57] rounded-2xl shadow-2xl p-2 space-y-1.5 z-50">
                  <div className="flex items-center justify-between px-2 py-1">
                    <span className="text-[11px] font-bold text-purple-200">Korna & Zil</span>
                    <TezgahBildirimCubugu
                      panelTuru="kurye"
                      onSesTesti={() => {
                        kuryeZiliCal('Korna Testi 🛵', 'Kurye arka plan paketi uyarısı hazır.');
                        setMobilMenuAcik(false);
                      }}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setMobilMenuAcik(false);
                      setSozlesmeModaliAcik(true);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-[#290F30] hover:bg-[#371440] text-amber-300 text-xs font-bold cursor-pointer transition-all"
                  >
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <span>Sözleşme Onayı</span>
                  </button>

                  {androidIcinde && !pilMuafiyetiVar && (
                    <button
                      type="button"
                      onClick={() => {
                        setMobilMenuAcik(false);
                        androidPilMuafiyetiIste();
                        setTimeout(() => setPilMuafiyetiVar(androidPilMuafiyetiVarMi()), 1500);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-950/60 hover:bg-amber-900/70 text-amber-300 text-xs font-bold cursor-pointer transition-all"
                    >
                      <BatteryCharging className="w-4 h-4 shrink-0" />
                      <span>Pil Kısıtlamasını Kaldır</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setMobilMenuAcik(false);
                      androidOturumTemizle();
                      cikisYap();
                      panelDegistir('vitrin');
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900/70 text-rose-300 text-xs font-bold cursor-pointer transition-all"
                  >
                    <LogOut className="w-4 h-4 shrink-0" />
                    <span>Güvenli Çıkış</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Gövde İçeriği */}
      <main className="anasayfa-genislik px-4 pt-5 space-y-5">

        {guncellemeVar && yeniSurumBilgisi && (
          <ApkGuncellemeUyarisi
            surumBilgisi={yeniSurumBilgisi}
            indiriliyor={apkIndiriliyor}
            hataMesaji={apkHataMesaji}
            onSimdiGuncelle={simdiGuncelle}
            onKapat={guncellemeUyariKapat}
          />
        )}

        {bilgiMesaji && (
          <div className="p-3 rounded-2xl bg-emerald-950/85 border border-emerald-500/60 text-emerald-200 text-xs font-bold text-center shadow-lg">
            {bilgiMesaji}
          </div>
        )}

        {/* Sekme 1: Aktif Paketler */}
        {aktifSekme === 'aktif_paketler' && (
          <div className="space-y-4">
            {toplamAktifGorevSayisi === 0 ? (
              <div className="py-12 px-5 text-center bg-[#180A1F] rounded-3xl border border-[#3E1646] flex flex-col items-center justify-center space-y-3 shadow-lg">
                <div className="relative">
                  <div className="w-14 h-14 rounded-2xl bg-[#270F30] border border-[#4D1E57] flex items-center justify-center shadow-inner">
                    <Bike className="w-7 h-7 text-amber-400" />
                  </div>
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-[#180A1F] animate-pulse" />
                </div>
                <div className="space-y-1 max-w-sm">
                  <h3 className="font-sans font-extrabold text-white text-base">
                    Üzerinizde Bekleyen Paket Yok
                  </h3>
                  <p className="text-xs text-purple-200/75 leading-relaxed">
                    Mutfakta veya şubede yeni bir sipariş hazır olduğunda sevk masasında otomatik görünecektir.
                  </p>
                </div>
                <div className="pt-1">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/35 text-[11px] font-bold text-emerald-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    Sistem Canlı Dinlemede
                  </span>
                </div>
              </div>
            ) : (
              <>
                {aktifSubeSiparisleri.map((siparis) => (
                  <SubeSiparisKarti
                    key={`sube-${siparis.id}`}
                    siparis={siparis}
                    kuryeId={kuryeId}
                    onKabulEt={subeKabulEtVeBildir}
                    onTeslimAl={subeTeslimAlVeBildir}
                    onTeslimEt={subeTeslimEtVeBildir}
                    onHaritaAc={(s) => setHaritaPaket(s)}
                  />
                ))}

                {aktifPaketler.map((paket) => (
                  <KuryePaketKarti
                    key={paket.id}
                    paket={paket}
                    kuryeId={kuryeId}
                    onPaketAl={paketAlVeBildir}
                    onPaketiTeslimAldi={async (id: string) => {
                      const sonuc = await paketiTeslimAldiBildir(id);
                      mesajGoster(sonuc.mesaj);
                    }}
                    onTeslimEt={teslimEtVeBildir}
                    onPaketiIptalEt={paketIptalEtVeBildir}
                    onQrAc={(kod: string) => {
                      setSeciliSiparisKodu(kod);
                      setQrTaramaAcik(true);
                    }}
                    onHaritaAc={(pkt: any) => setHaritaPaket(pkt)}
                  />
                ))}
              </>
            )}
          </div>
        )}

        {/* Sekme 2: Teslim Edilenler */}
        {aktifSekme === 'gecmis' && (
          <div className="space-y-3">
            {tumTeslimEdilenler.length === 0 ? (
              <div className="py-12 px-5 text-center bg-[#180A1F] rounded-3xl border border-[#3E1646] flex flex-col items-center justify-center space-y-2">
                <CheckCircle2 className="w-9 h-9 text-purple-400 mx-auto opacity-75" />
                <h3 className="font-sans font-extrabold text-white text-sm">
                  Bugün Henüz Tamamlanan Teslimat Yok
                </h3>
                <p className="text-xs text-purple-200/75">
                  Teslim ettiğiniz paketler bu ekranda primleriyle listelenir.
                </p>
              </div>
            ) : (
              tumTeslimEdilenler.map((teslimat: any) => (
                <div
                  key={teslimat.id}
                  className="p-4 rounded-2xl bg-[#180A1F] border border-[#3E1646] hover:border-purple-700/70 transition-all flex justify-between items-center text-xs shadow-sm"
                >
                  <div className="min-w-0">
                    <span className="font-bold text-white block truncate">
                      {teslimat.sube_adi ? `🏪 ${teslimat.sube_adi} • ` : ''}
                      #{teslimat.siparis_kodu || teslimat.siparisKodu || teslimat.id} — {teslimat.musteri_adi || teslimat.musteriAdi || 'Müşteri'}
                    </span>
                    <p className="text-[11px] text-purple-200/75 mt-1 truncate">
                      {teslimat.teslimat_adresi_metni || teslimat.teslimatAdresiMetni || teslimat.adres || 'Afyonkarahisar'} • Teslim Edildi
                    </p>
                  </div>
                  <span className="text-emerald-400 font-black font-mono text-sm shrink-0 pl-3">+45 ₺</span>
                </div>
              ))
            )}
          </div>
        )}

        {/* Sekme 3: Kurye Cüzdanı & Hakediş Çekim */}
        {aktifSekme === 'kazanc' && (
          <KuryeCuzdanSekmesi
            kuryeId={kuryeId}
            kuryeAdi={kuryeAdi}
            aktifKullanici={aktifKullanici}
            teslimEdilenler={tumTeslimEdilenler}
          />
        )}

      </main>

      {/* Akıllı Kaydırma Duyarlı Mobil & Masaüstü Alt Menü (Yukarı Çıkarken Görünür, Aşağı İnerken Gizlenir) */}
      <KuryeAltMenu
        aktifSekme={aktifSekme}
        onSekmeDegistir={setAktifSekme}
        aktifPaketSayisi={toplamAktifGorevSayisi}
        teslimEdilenSayisi={tumTeslimEdilenler.length}
      />

      {/* Kurye QR & PIN Doğrulama Modalı (Dinamik Sipariş Kodu ile) */}
      {qrTaramaAcik && (
        <KuryeQrTarayiciModali
          siparisKodu={seciliSiparisKodu}
          onKapat={() => setQrTaramaAcik(false)}
          onTeslimatTamamlandi={async (kod: string, pin: string, dogrulamaYontemi?: 'pin' | 'qr') => {
            return await teslimEtVeBildir(kod, pin, dogrulamaYontemi);
          }}
        />
      )}

      {/* Kurye Canlı Harita & Rota Modalı */}
      {haritaPaket && (
        <KuryeHaritaModali
          paket={haritaPaket}
          kuryeKonum={sonKonum}
          onKapat={() => setHaritaPaket(null)}
        />
      )}

      {/* Kurye Taşıma Sözleşmesi & KVKK Zaman Damgalı Onay Modalı */}
      {sozlesmeModaliAcik && (
        <KuryeSozlesmeOnayModali
          kuryeId={kuryeId}
          kuryeAdi={kuryeAdi}
          kuryeTelefon={kuryeTelefon}
          onKapat={() => setSozlesmeModaliAcik(false)}
          onOnayTamamlandi={() => {
            mesajGoster('Kurye taşıma sözleşmesi ve KVKK onayı zaman damgasıyla mühürlendi.');
          }}
        />
      )}
    </div>
  );
};
