import React, { useState } from 'react';
import {
  Bike,
  CheckCircle2,
  KeyRound,
  MapPin,
  Navigation,
  Phone,
  Store
} from 'lucide-react';
import { SubeSiparisi } from '@/src/MalzemeCekmeceleri/KuryeTeslimat/SubeSiparisServisi';

export interface SubeSiparisKartiProps {
  siparis: SubeSiparisi;
  kuryeId: string;
  onKabulEt: (siparisId: string) => Promise<{ basarili: boolean; mesaj: string }>;
  onTeslimAl: (
    siparisId: string,
    girilenPin?: string
  ) => Promise<{ basarili: boolean; mesaj: string }>;
  onTeslimEt: (siparisId: string) => Promise<{ basarili: boolean; mesaj: string }>;
  onHaritaAc: (siparis: SubeSiparisi) => void;
}

export const SubeSiparisKarti: React.FC<SubeSiparisKartiProps> = ({
  siparis,
  kuryeId,
  onKabulEt,
  onTeslimAl,
  onTeslimEt,
  onHaritaAc
}) => {
  const [pinGirdisi, setPinGirdisi] = useState('');
  const [islemde, setIslemde] = useState(false);
  const [hataMesaji, setHataMesaji] = useState('');

  const siparisKodu = siparis.siparis_kodu || siparis.id;
  const subeAdi = siparis.sube_adi || 'Afyon Ev Lezzetleri Şubesi';
  const musteriAdi = siparis.musteri_adi || 'Müşteri';
  const musteriTelefon = siparis.musteri_telefon || '';
  const teslimatAdresi = siparis.teslimat_adresi_metni || 'Adres belirtilmedi';
  const pinKodu = siparis.pin_kodu !== undefined && siparis.pin_kodu !== null
    ? String(siparis.pin_kodu)
    : '';
  const durum = (siparis.durum || '').toLowerCase();
  const benimUzerimde = siparis.kurye_id === kuryeId;
  const yoldaMi = durum === 'yolda';

  const handleKabulEt = async () => {
    setIslemde(true);
    setHataMesaji('');
    try {
      const sonuc = await onKabulEt(siparis.id);
      if (!sonuc.basarili) {
        setHataMesaji(sonuc.mesaj);
      }
    } finally {
      setIslemde(false);
    }
  };

  const handleTeslimAl = async (e: React.FormEvent) => {
    e.preventDefault();
    setIslemde(true);
    setHataMesaji('');
    try {
      const sonuc = await onTeslimAl(siparis.id, pinGirdisi);
      if (!sonuc.basarili) {
        setHataMesaji(sonuc.mesaj);
      } else {
        setPinGirdisi('');
      }
    } finally {
      setIslemde(false);
    }
  };

  const handleTeslimEt = async () => {
    setIslemde(true);
    setHataMesaji('');
    try {
      const sonuc = await onTeslimEt(siparis.id);
      if (!sonuc.basarili) {
        setHataMesaji(sonuc.mesaj);
      }
    } finally {
      setIslemde(false);
    }
  };

  return (
    <div className="bg-[#180A1F] border border-emerald-700/50 hover:border-emerald-500/70 rounded-2xl p-4 sm:p-5 transition-all shadow-md">
      {/* Üst Başlık */}
      <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-purple-900/50">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] px-2 py-0.5 rounded-full font-black bg-emerald-950/90 text-emerald-300 border border-emerald-500/40">
            🏪 Şube Siparişi
          </span>
          <span className="text-amber-400 font-black text-sm">#{siparisKodu}</span>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
              benimUzerimde
                ? yoldaMi
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
            }`}
          >
            {benimUzerimde
              ? yoldaMi
                ? '🛵 Müşteriye Teslimatta'
                : '🏪 Kurye Geliyor (Şubeden Alınacak)'
              : '📢 Şube Havuzunda Teslime Hazır'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {pinKodu && (
            <span className="px-2.5 py-1 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 font-mono font-black text-xs flex items-center gap-1">
              <KeyRound className="w-3 h-3" />
              <span>PIN: {pinKodu}</span>
            </span>
          )}
          {typeof siparis.toplam_tutar === 'number' && siparis.toplam_tutar > 0 && (
            <span className="text-sm font-black text-emerald-400">
              {siparis.toplam_tutar} ₺
            </span>
          )}
        </div>
      </div>

      {/* Şube ve Müşteri Adres Bilgileri */}
      <div className="py-3 space-y-2 text-xs">
        <div className="flex items-start gap-2 text-purple-200">
          <Store className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-white">{subeAdi}</span>
            <p className="text-[11px] text-purple-400">Teslim Alınacak Şube</p>
          </div>
        </div>

        <div className="flex items-start gap-2 text-gray-300">
          <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-white">{musteriAdi}</span>
            <p className="text-[11px] text-gray-300 leading-relaxed mt-0.5">{teslimatAdresi}</p>
          </div>
        </div>

        {Array.isArray(siparis.urunler) && siparis.urunler.length > 0 && (
          <div className="p-2 rounded-xl bg-[#110416] border border-purple-900/40 text-[11px] text-gray-300">
            <span className="text-purple-300 font-semibold">Ürünler: </span>
            {siparis.urunler
              .map((u) => `${u.adet ?? u.miktar ?? 1}x ${u.urun_adi || u.ad || u.urun_id || 'Ürün'}`)
              .join(', ')}
          </div>
        )}

        {siparis.siparis_notu && (
          <div className="p-2 rounded-xl bg-purple-950/40 border border-purple-900/30 text-[11px] text-amber-200/90 italic">
            Not: &quot;{siparis.siparis_notu}&quot;
          </div>
        )}
      </div>

      {hataMesaji && (
        <div className="mb-3 p-2 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-200 text-xs">
          {hataMesaji}
        </div>
      )}

      {/* Aksiyon Alanı */}
      <div className="pt-2 border-t border-purple-900/50 space-y-2">
        {!benimUzerimde ? (
          <button
            type="button"
            disabled={islemde}
            onClick={handleKabulEt}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-black font-black text-xs shadow-md shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
          >
            <Bike className="w-4 h-4" />
            <span>{islemde ? 'Kabul Ediliyor...' : 'İşi Kabul Et (Şubeye Git) 🛵'}</span>
          </button>
        ) : !yoldaMi ? (
          <form onSubmit={handleTeslimAl} className="space-y-2">
            <div className="relative">
              <KeyRound className="w-3.5 h-3.5 text-amber-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                maxLength={8}
                value={pinGirdisi}
                onChange={(e) => setPinGirdisi(e.target.value)}
                placeholder="İsteğe bağlı PIN doğrulama (boş bırakılabilir)"
                className="w-full bg-[#100313] border border-purple-900/60 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-400 font-mono tracking-wider"
              />
            </div>
            <button
              type="submit"
              disabled={islemde}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 text-white font-black text-xs shadow-md shadow-purple-600/20 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{islemde ? 'İşleniyor...' : 'Şubeden Teslim Aldım (Yola Çık) 📦'}</span>
            </button>
          </form>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onHaritaAc(siparis)}
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
                  <span>Müşteriyi Ara</span>
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
            </div>

            <button
              type="button"
              disabled={islemde}
              onClick={handleTeslimEt}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 text-black font-black text-xs shadow-md shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{islemde ? 'Tamamlanıyor...' : 'Müşteriye Teslim Et ✅'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
