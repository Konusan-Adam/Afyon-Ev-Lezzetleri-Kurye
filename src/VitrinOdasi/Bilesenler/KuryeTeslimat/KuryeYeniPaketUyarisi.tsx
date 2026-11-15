import React from 'react';
import { Bike, X, ArrowRight, MapPin, DollarSign, Clock, AlertTriangle } from 'lucide-react';
import { YeniPaketBildirimi } from '@/src/MalzemeCekmeceleri/KuryeTeslimat/useKuryeBildirimleri';

interface KuryeYeniPaketUyarisiProps {
  uyari: YeniPaketBildirimi | null;
  onKapat: () => void;
  onPaketAl: (id: string) => Promise<void> | void;
}

export const KuryeYeniPaketUyarisi: React.FC<KuryeYeniPaketUyarisiProps> = ({
  uyari,
  onKapat,
  onPaketAl
}) => {
  if (!uyari) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-gradient-to-b from-[#2A0E30] to-[#140618] border-2 border-amber-500 rounded-3xl p-6 shadow-2xl shadow-amber-500/20 text-white relative">
        <button
          type="button"
          onClick={onKapat}
          className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500 text-black flex items-center justify-center animate-bounce">
            <Bike className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500 text-white animate-pulse">
                Canlı Sipariş
              </span>
              <span className="text-xs text-amber-300 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {uyari.zaman}
              </span>
            </div>
            <h2 className="text-lg font-black text-amber-300">Yeni Paket Mutfakta Hazır! 🛵</h2>
          </div>
        </div>

        <div className="bg-[#1C0922] rounded-2xl p-4 border border-purple-800/50 space-y-3 mb-6">
          <div className="flex justify-between items-center pb-2 border-b border-purple-900/60">
            <span className="text-xs text-gray-400">Sipariş Takip Kodu</span>
            <span className="text-sm font-black text-amber-400">#{uyari.siparisKodu}</span>
          </div>

          <div className="flex items-start gap-2.5 text-xs text-gray-300">
            <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{uyari.adres}</span>
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-purple-900/60">
            <span className="text-xs text-gray-400">Toplam Sipariş Tutarı</span>
            <span className="text-base font-black text-emerald-400">{uyari.tutar} ₺</span>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onKapat}
            className="flex-1 py-3 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-gray-300 font-bold text-xs transition-colors"
          >
            Sonra Bak
          </button>
          <button
            type="button"
            onClick={() => {
              onPaketAl(uyari.id);
              onKapat();
            }}
            className="flex-2 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-black text-xs shadow-lg shadow-amber-500/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <span>Hemen Üzerime Al 🚀</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
