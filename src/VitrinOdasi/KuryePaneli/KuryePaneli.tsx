import React, { useState } from 'react';
import { 
  Bike, 
  MapPin, 
  Phone, 
  Navigation, 
  CheckCircle2, 
  ShieldCheck, 
  Clock, 
  DollarSign, 
  Power,
  Store,
  User,
  ArrowLeft,
  LogOut,
  Wallet
} from 'lucide-react';
import { kullaniciHafizasiKullan } from '@/src/OrtakHavuz/KullaniciHafizasi';
import { KuryeCuzdanSekmesi } from './KuryeCuzdanSekmesi';
import { KuryeQrTarayiciModali } from '../Bilesenler/QrTeslimat/KuryeQrTarayiciModali';
import { KuryeHaritaModali } from '../Bilesenler/KuryeTeslimat/KuryeHaritaModali';
import { QrCode } from 'lucide-react';
import { useKuryeCanliPaketler } from '@/src/MalzemeCekmeceleri/KuryeTeslimat/useKuryeCanliPaketler';
import { KuryePaketKarti } from '../Bilesenler/KuryeTeslimat/KuryePaketKarti';
import { useKuryeKonumYayini } from '@/src/MalzemeCekmeceleri/KuryeTeslimat/useKuryeKonumYayini';
import { useKuryeBildirimleri } from '@/src/MalzemeCekmeceleri/KuryeTeslimat/useKuryeBildirimleri';
import { KuryeYeniPaketUyarisi } from '../Bilesenler/KuryeTeslimat/KuryeYeniPaketUyarisi';
import { TezgahBildirimCubugu } from '../Bilesenler/TezgahBildirimCubugu';
import { kuryeZiliCal } from '@/src/MalzemeCekmeceleri/KuryeTeslimat/KuryeZilServisi';

export const KuryePaneli: React.FC = () => {
  const { aktifKullanici, panelDegistir, cikisYap } = kullaniciHafizasiKullan();
  const [gorevde, setGorevde] = useState(true);
  const [aktifSekme, setAktifSekme] = useState<'aktif_paketler' | 'gecmis' | 'kazanc'>('aktif_paketler');
  const [qrTaramaAcik, setQrTaramaAcik] = useState(false);
  const [seciliSiparisKodu, setSeciliSiparisKodu] = useState('');
  const [haritaPaket, setHaritaPaket] = useState<any | null>(null);
  const [bilgiMesaji, setBilgiMesaji] = useState('');

  const kuryeId = aktifKullanici?.kimlik || aktifKullanici?.id || 'kurye-1';
  const kuryeAdi = aktifKullanici?.ad_soyad || 'Kurye';
  const kuryeTelefon = aktifKullanici?.telefon || '';

  // 🔔 Kurye Dağıtım & Paket Var Canlı Dedektörü
  const { yeniPaketUyarisi, uyariKapat } = useKuryeBildirimleri(kuryeId);

  const { aktifPaketler, teslimEdilenler, paketiAl, paketiTeslimAldiBildir, teslimEt, paketiIptalEt } = useKuryeCanliPaketler(
    kuryeId,
    kuryeAdi,
    kuryeTelefon
  );

  const aktifPaketIdleri = aktifPaketler.map(p => p.id || p.siparis_kodu || p.siparisKodu);
  const { yayinAktif, sonKonum } = useKuryeKonumYayini({
    kuryeId,
    kuryeAdi,
    telefon: kuryeTelefon,
    aracTipi: aktifKullanici?.arac_tipi,
    plaka: aktifKullanici?.plaka,
    gorevde,
    aktifPaketIdleri
  });

  const paketAlVeBildir = async (id: string, tahminiDakika: number = 15) => {
    const sonuc = await paketiAl(id, tahminiDakika);
    setBilgiMesaji(sonuc.mesaj);
    setTimeout(() => setBilgiMesaji(''), 4000);
  };

  const teslimEtVeBildir = async (kod: string, pin: string) => {
    const sonuc = await teslimEt(kod, pin);
    setBilgiMesaji(sonuc.mesaj);
    setTimeout(() => setBilgiMesaji(''), 4000);
    return sonuc;
  };

  const paketIptalEtVeBildir = async (id: string, gerekce: string, detayNot?: string) => {
    const sonuc = await paketiIptalEt(id, gerekce, detayNot);
    setBilgiMesaji(sonuc.mesaj);
    setTimeout(() => setBilgiMesaji(''), 4000);
    return sonuc;
  };

  return (
    <div className="w-full min-h-screen bg-[#0C020E] text-gray-200 select-none pb-16">
      
      {/* 🔔 YENİ PAKET HAZIR CANLI FLAŞ BİLDİRİMİ & KORNA ALARMI */}
      <KuryeYeniPaketUyarisi 
        uyari={yeniPaketUyarisi} 
        onKapat={uyariKapat} 
        onPaketAl={paketAlVeBildir} 
      />

      {/* 👑 PATRON TEST GEÇİŞ BANNERI (Yalnızca Patron/Yönetici İse Görünür) */}
      {aktifKullanici?.rol === 'yonetici' && (
        <div className="bg-gradient-to-r from-amber-600 via-purple-900 to-amber-700 text-white px-4 py-2 text-xs flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-amber-300" />
            <span className="font-bold">KURYE DAĞITIM MASASI (Patron Önizleme Modu)</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => panelDegistir('vitrin')}
              className="bg-black/50 hover:bg-black/80 px-3 py-1 rounded-lg text-white font-extrabold border border-white/20 text-[11px] cursor-pointer flex items-center gap-1 transition-all"
            >
              <span>🏠 Vitrine Dön</span>
            </button>
            <button
              type="button"
              onClick={() => panelDegistir('patron')}
              className="bg-black/50 hover:bg-black/80 px-3 py-1 rounded-lg text-amber-300 font-extrabold border border-amber-400/40 text-[11px] cursor-pointer flex items-center gap-1 transition-all"
            >
              <span>👑 Patron Masasına Dön</span>
            </button>
          </div>
        </div>
      )}

      {/* Üst Başlık Barı */}
      <header className="bg-[#180A1F] border-b border-[#3E1646] px-4 py-4">
        <div className="anasayfa-genislik flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => panelDegistir('vitrin')}
              className="p-2 rounded-xl bg-[#2D1233] text-purple-300 hover:text-white border border-purple-800/40 cursor-pointer"
              title="Vitrini Aç"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-purple-800 flex items-center justify-center text-white shadow-md">
              <Bike className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-white font-black text-sm sm:text-base">
                  {aktifKullanici?.ad_soyad || 'Kurye Personeli'}
                </h1>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {aktifKullanici?.arac_tipi || 'Motorlu Kurye'}
                </span>
              </div>
              <p className="text-xs text-purple-300">
                {aktifKullanici?.ilce ? `${aktifKullanici.ilce} Bölgesi` : 'Afyonkarahisar'} • {aktifKullanici?.plaka ? `Plaka: ${aktifKullanici.plaka}` : 'Plaka Belirtilmedi'}
              </p>
            </div>
          </div>

          {/* Görevde / Molada & Güvenli Çıkış Butonları */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <TezgahBildirimCubugu panelTuru="kurye" onSesTesti={() => kuryeZiliCal('Korna Testi 🛵', 'Kurye arka plan paketi uyarısı hazır.')} />
            <button
              type="button"
              onClick={() => setGorevde(!gorevde)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                gorevde
                  ? 'bg-emerald-950/80 border border-emerald-500 text-emerald-300 shadow-sm'
                  : 'bg-amber-950/80 border border-amber-500 text-amber-300'
              }`}
            >
              <Power className="w-3.5 h-3.5" />
              <span>{gorevde ? 'Görevde (Paket Alabilir)' : 'Molada (Pasif)'}</span>
            </button>

            {gorevde && (
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-950/70 border border-amber-500/40 text-[11px] font-bold text-amber-300 shadow-sm">
                <span className={`w-2 h-2 rounded-full ${yayinAktif ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`} />
                <span>{yayinAktif ? 'Canlı GPS Yayında 🛰️' : 'GPS Aranıyor...'}</span>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                cikisYap();
                panelDegistir('vitrin');
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 border border-rose-800/50 text-rose-300 text-xs font-bold transition-all cursor-pointer"
              title="Güvenli Çıkış Yap"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Güvenli Çıkış</span>
            </button>
          </div>
        </div>
      </header>

      {/* Gövde ve Sekmeler */}
      <main className="anasayfa-genislik px-4 pt-6 space-y-6">
        
        {/* Sekmeler */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar border-b border-purple-950">
          <button
            type="button"
            onClick={() => setAktifSekme('aktif_paketler')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer whitespace-nowrap ${
              aktifSekme === 'aktif_paketler'
                ? 'bg-[#6D237A] text-white shadow-md'
                : 'bg-[#180A1F] text-gray-400 hover:text-white border border-[#3E1646]'
            }`}
          >
            <Bike className="w-4 h-4 text-amber-400" />
            <span>Dağıtım Bekleyen Paketler ({aktifPaketler.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setAktifSekme('gecmis')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer whitespace-nowrap ${
              aktifSekme === 'gecmis'
                ? 'bg-[#6D237A] text-white shadow-md'
                : 'bg-[#180A1F] text-gray-400 hover:text-white border border-[#3E1646]'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 text-amber-400" />
            <span>Bugün Teslim Edilenler ({teslimEdilenler.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setAktifSekme('kazanc')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer whitespace-nowrap ${
              aktifSekme === 'kazanc'
                ? 'bg-[#6D237A] text-white shadow-md'
                : 'bg-[#180A1F] text-gray-400 hover:text-white border border-[#3E1646]'
            }`}
          >
            <Wallet className="w-4 h-4 text-emerald-400" />
            <span>Cüzdanım & Hakediş Çekim</span>
          </button>
        </div>

        {bilgiMesaji && (
          <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-500/60 text-emerald-200 text-xs font-bold text-center">
            {bilgiMesaji}
          </div>
        )}

        {/* Sekme 1: Aktif Paketler */}
        {aktifSekme === 'aktif_paketler' && (
          <div className="space-y-4">
            {aktifPaketler.length === 0 ? (
              <div className="p-8 text-center bg-[#180A1F] rounded-2xl border border-purple-900/40 space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                <h3 className="font-bold text-white text-sm">Üzerinizde Bekleyen Paket Yok</h3>
                <p className="text-xs text-gray-400">Yeni bir sipariş mutfakta hazır olduğunda sevk masasında otomatik görünecektir.</p>
              </div>
            ) : (
              aktifPaketler.map((paket) => (
                <KuryePaketKarti
                  key={paket.id}
                  paket={paket}
                  kuryeId={kuryeId}
                  onPaketAl={paketAlVeBildir}
                  onPaketiTeslimAldi={async (id: string) => {
                    const sonuc = await paketiTeslimAldiBildir(id);
                    setBilgiMesaji(sonuc.mesaj);
                    setTimeout(() => setBilgiMesaji(''), 4000);
                  }}
                  onTeslimEt={teslimEtVeBildir}
                  onPaketiIptalEt={paketIptalEtVeBildir}
                  onQrAc={(kod: string) => {
                    setSeciliSiparisKodu(kod);
                    setQrTaramaAcik(true);
                  }}
                  onHaritaAc={(pkt: any) => setHaritaPaket(pkt)}
                />
              ))
            )}
          </div>
        )}

        {/* Sekme 2: Teslim Edilenler */}
        {aktifSekme === 'gecmis' && (
          <div className="space-y-3">
            {teslimEdilenler.length === 0 ? (
              <div className="p-8 text-center bg-[#180A1F] rounded-2xl border border-purple-900/40 space-y-2">
                <CheckCircle2 className="w-8 h-8 text-purple-400 mx-auto opacity-60" />
                <h3 className="font-bold text-white text-xs">Bugün Henüz Tamamlanan Teslimat Yok</h3>
                <p className="text-[11px] text-gray-400">Teslim ettiğiniz paketler bu ekranda primleriyle listelenir.</p>
              </div>
            ) : (
              teslimEdilenler.map((teslimat: any) => (
                <div
                  key={teslimat.id}
                  className="p-3.5 rounded-2xl bg-[#180A1F] border border-[#3E1646] hover:border-purple-800 transition-all flex justify-between items-center text-xs"
                >
                  <div>
                    <span className="font-bold text-white">#{teslimat.siparisKodu || teslimat.id} — {teslimat.musteriAdi || 'Müşteri'}</span>
                    <p className="text-[11px] text-gray-400 mt-0.5">{teslimat.teslimatAdresiMetni || teslimat.adres || 'Afyonkarahisar'} • (Teslim Edildi)</p>
                  </div>
                  <span className="text-emerald-400 font-bold">+45 ₺ Prim</span>
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
            teslimEdilenler={teslimEdilenler}
          />
        )}

      </main>

      {/* Kurye QR & PIN Doğrulama Modalı (Dinamik Sipariş Kodu ile) */}
      {qrTaramaAcik && (
        <KuryeQrTarayiciModali
          siparisKodu={seciliSiparisKodu}
          onKapat={() => setQrTaramaAcik(false)}
          onTeslimatTamamlandi={async (kod: string, pin: string) => {
            return await teslimEtVeBildir(kod, pin);
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
    </div>
  );
};
