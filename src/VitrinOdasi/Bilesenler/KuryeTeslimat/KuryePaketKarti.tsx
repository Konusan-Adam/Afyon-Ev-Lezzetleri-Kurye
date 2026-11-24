import React, { useState } from 'react';
import {
  Bike,
  MapPin,
  Phone,
  Navigation,
  CheckCircle2,
  QrCode,
  KeyRound,
  Store,
  XCircle
} from 'lucide-react';

export interface KuryePaketKartiProps {
  paket: any;
  kuryeId: string;
  onPaketAl: (id: string, tahminiDakika?: number) => Promise<void> | void;
  onPaketiTeslimAldi: (id: string) => Promise<void> | void;
  onTeslimEt: (kod: string, pin: string, dogrulamaYontemi?: 'pin' | 'qr') => Promise<any>;
  onPaketiIptalEt?: (id: string, gerekce: string, detayNot?: string) => Promise<any>;
  onQrAc: (kod: string) => void;
  onHaritaAc: (pkt: any) => void;
}

const KURYE_IPTAL_GEREKCELERI = [
  'Müşteriye ulaşılamıyor',
  'Adres teslimat bölgesi dışında',
  'Müşteri talebiyle iptal',
  'Araç arızası / Teslimat engeli'
];

export const KuryePaketKarti: React.FC<KuryePaketKartiProps> = ({
  paket,
  kuryeId,
  onPaketAl,
  onPaketiTeslimAldi,
  onTeslimEt,
  onPaketiIptalEt,
  onQrAc,
  onHaritaAc
}) => {
  const [pinGirdisi, setPinGirdisi] = useState('');
  const [tahminiDakika, setTahminiDakika] = useState<number>(15);
  const [iptalPaneliAcik, setIptalPaneliAcik] = useState(false);
  const [iptalGerekcesi, setIptalGerekcesi] = useState(KURYE_IPTAL_GEREKCELERI[0]);
  const [iptalNotu, setIptalNotu] = useState('');
  const [islemde, setIslemde] = useState(false);
  const [hataMesaji, setHataMesaji] = useState('');

  const siparisKodu = paket.siparis_kodu || paket.siparisKodu || paket.id;
  const musteriAdi = paket.musteri_adi || paket.musteriAdi || 'Müşteri';
  const musteriTelefon = paket.musteri_telefon || paket.telefon || '';
  const teslimatAdresi = paket.teslimat_adresi_metni || paket.teslimatAdresiMetni || paket.adres || 'Afyonkarahisar';
  const toplamTutar = paket.toplam_tutar || paket.tutar || paket.toplamTutar || 0;
  const mutfakAdi = paket.mutfak_adi || paket.mutfakAdi || 'Afyon Ev Mutfağı';

  const durum = (paket.durum || '').toLowerCase();
  const asama = (paket.asama || '').toLowerCase();

  const benimUzerimde = paket.kurye_id === kuryeId;
  const mutfaktanAlindi = durum === 'yolda' || asama === 'kuryede' || asama === 'kurye_geliyor_musteriye';

  const handlePinTeslimat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinGirdisi.trim()) {
      setHataMesaji('Lütfen 4 haneli müşteri teslimat PIN kodunu giriniz.');
      return;
    }
    setIslemde(true);
    setHataMesaji('');
    try {
      const res = await onTeslimEt(siparisKodu, pinGirdisi.trim(), 'pin');
      if (res && !res.basarili) {
        setHataMesaji(res.mesaj || 'PIN doğrulanamadı.');
      }
    } catch (err: any) {
      setHataMesaji(err.message || 'Teslimat hatası oluştu.');
    } finally {
      setIslemde(false);
    }
  };

  const handleKuryeIptal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onPaketiIptalEt) return;
    setIslemde(true);
    setHataMesaji('');
    try {
      const res = await onPaketiIptalEt(paket.id || siparisKodu, iptalGerekcesi, iptalNotu);
      if (res && !res.basarili) {
        setHataMesaji(res.mesaj || 'İptal işlemi başarısız oldu.');
      } else {
        setIptalPaneliAcik(false);
        setIptalNotu('');
      }
    } catch (err: any) {
      setHataMesaji(err.message || 'İptal sırasında hata oluştu.');
    } finally {
      setIslemde(false);
    }
  };

  return (
    <div className="bg-[#180A1F] border border-[#3E1646] hover:border-purple-700/60 rounded-2xl p-4 sm:p-5 transition-all shadow-md">
      {/* Kart Üst Başlık */}
      <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-purple-900/50">
        <div className="flex items-center gap-2">
          <span className="text-amber-400 font-black text-sm">#{siparisKodu}</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
            benimUzerimde
              ? mutfaktanAlindi
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-purple-500/20 text-purple-300 border-purple-500/40'
              : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
          }`}>
            {benimUzerimde
              ? mutfaktanAlindi
                ? '🛵 Müşteriye Teslimatta'
                : '👨‍🍳 Mutfaktan Alınmayı Bekliyor'
              : '📢 Sevk Masasında Hazır'}
          </span>
        </div>

        <span className="text-sm font-black text-emerald-400">
          {toplamTutar} ₺
        </span>
      </div>

      {/* Adres ve Bilgiler */}
      <div className="py-3 space-y-2 text-xs">
        <div className="flex items-start gap-2 text-purple-200">
          <Store className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-white">{mutfakAdi}</span>
            <p className="text-[11px] text-purple-400">Mutfak Hazırladı</p>
          </div>
        </div>

        <div className="flex items-start gap-2 text-gray-300">
          <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-white">{musteriAdi}</span>
            <p className="text-[11px] text-gray-300 leading-relaxed mt-0.5">{teslimatAdresi}</p>
          </div>
        </div>

        {paket.siparis_notu && (
          <div className="p-2 rounded-xl bg-purple-950/40 border border-purple-900/30 text-[11px] text-amber-200/90 italic">
            Not: &quot;{paket.siparis_notu}&quot;
          </div>
        )}
      </div>

      {/* Hata Mesajı */}
      {hataMesaji && (
        <div className="mb-3 p-2 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-200 text-xs">
          {hataMesaji}
        </div>
      )}

      {/* Aksiyon Butonları */}
      <div className="pt-2 border-t border-purple-900/50 flex flex-wrap gap-2 items-center justify-between">
        {!benimUzerimde ? (
          <div className="w-full space-y-2">
            <div className="flex items-center justify-between gap-2 text-[11px] text-purple-200">
              <span>Mutfağa tahmini varış süresi:</span>
              <select
                value={tahminiDakika}
                onChange={(e) => setTahminiDakika(Number(e.target.value))}
                className="bg-[#100313] border border-purple-800 rounded-lg px-2 py-1 text-xs text-amber-300 font-bold focus:outline-none focus:border-amber-400"
              >
                <option value={10}>10 dk</option>
                <option value={15}>15 dk</option>
                <option value={20}>20 dk</option>
                <option value={30}>30 dk</option>
              </select>
            </div>
            <button
              type="button"
              onClick={() => onPaketAl(paket.id || siparisKodu, tahminiDakika)}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-black font-black text-xs shadow-md shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              <Bike className="w-4 h-4" />
              <span>Paketi Üzerime Al 🛵</span>
            </button>
          </div>
        ) : !mutfaktanAlindi ? (
          <div className="w-full space-y-2">
            <button
              type="button"
              onClick={() => onPaketiTeslimAldi(paket.id || siparisKodu)}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 text-white font-black text-xs shadow-md shadow-purple-600/20 flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Mutfaktan Teslim Aldım (Yola Çık) 📦</span>
            </button>
            {onPaketiIptalEt && (
              <button
                type="button"
                onClick={() => setIptalPaneliAcik(!iptalPaneliAcik)}
                className="w-full py-2 px-3 rounded-xl bg-rose-950/50 hover:bg-rose-900/70 border border-rose-800/50 text-rose-300 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Siparişi İptal Et</span>
              </button>
            )}
          </div>
        ) : (
          <div className="w-full space-y-3">
            {/* Buton Barı: Harita / Arama / QR */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => onHaritaAc(paket)}
                className="py-2 px-3 rounded-xl bg-[#2D1233] hover:bg-purple-900/80 border border-purple-800 text-purple-200 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all"
              >
                <Navigation className="w-3.5 h-3.5 text-amber-400" />
                <span>Harita</span>
              </button>

              {musteriTelefon ? (
                <a
                  href={`tel:${musteriTelefon}`}
                  className="py-2 px-3 rounded-xl bg-[#2D1233] hover:bg-purple-900/80 border border-purple-800 text-purple-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-all text-center"
                >
                  <Phone className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Ara</span>
                </a>
              ) : (
                <button
                  type="button"
                  disabled
                  className="py-2 px-3 rounded-xl bg-black/40 text-gray-500 border border-purple-900/40 text-xs flex items-center justify-center gap-1.5 cursor-not-allowed"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>No Yok</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => onQrAc(siparisKodu)}
                className="py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-700 to-emerald-600 hover:from-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition-all"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>QR Tara</span>
              </button>
            </div>

            {/* PIN ile Teslim Et Formu */}
            <form onSubmit={handlePinTeslimat} className="flex gap-2">
              <div className="relative flex-1">
                <KeyRound className="w-3.5 h-3.5 text-amber-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  maxLength={6}
                  value={pinGirdisi}
                  onChange={(e) => setPinGirdisi(e.target.value)}
                  placeholder="Müşteri PIN Kodu"
                  className="w-full bg-[#100313] border border-purple-900/60 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-400 font-mono tracking-wider"
                />
              </div>
              <button
                type="submit"
                disabled={islemde}
                className="py-2 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs transition-all cursor-pointer whitespace-nowrap disabled:opacity-50"
              >
                {islemde ? 'Doğrulanıyor...' : 'Teslim Et'}
              </button>
            </form>

            {onPaketiIptalEt && (
              <button
                type="button"
                onClick={() => setIptalPaneliAcik(!iptalPaneliAcik)}
                className="w-full py-2 px-3 rounded-xl bg-rose-950/50 hover:bg-rose-900/70 border border-rose-800/50 text-rose-300 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Teslimatı İptal Et</span>
              </button>
            )}
          </div>
        )}

        {/* Kurye İptal Formu */}
        {iptalPaneliAcik && onPaketiIptalEt && (
          <form onSubmit={handleKuryeIptal} className="w-full mt-2 p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 space-y-2">
            <label className="block text-[11px] font-bold text-rose-200">İptal Gerekçesi</label>
            <select
              value={iptalGerekcesi}
              onChange={(e) => setIptalGerekcesi(e.target.value)}
              className="w-full bg-[#100313] border border-rose-900/60 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-rose-400"
            >
              {KURYE_IPTAL_GEREKCELERI.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
            <input
              type="text"
              value={iptalNotu}
              onChange={(e) => setIptalNotu(e.target.value)}
              placeholder="İsteğe bağlı açıklama..."
              className="w-full bg-[#100313] border border-rose-900/60 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-rose-400"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIptalPaneliAcik(false)}
                className="flex-1 py-1.5 px-3 rounded-lg bg-black/40 text-gray-300 text-xs font-bold cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                type="submit"
                disabled={islemde}
                className="flex-1 py-1.5 px-3 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-black cursor-pointer disabled:opacity-50"
              >
                {islemde ? 'İptal Ediliyor...' : 'İptali Onayla'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
