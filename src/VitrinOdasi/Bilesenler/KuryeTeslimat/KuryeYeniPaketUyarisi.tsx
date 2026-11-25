import React from 'react';
import { Bike, X, ArrowRight, MapPin, Clock } from 'lucide-react';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 font-sans">
      <div className="w-full max-w-md bg-[#180A1F] border border-amber-500/45 rounded-3xl p-6 shadow-2xl shadow-purple-950/60 text-white relative">
        <button
          type="button"
          onClick={onKapat}
          className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-purple-200 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3.5 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500 text-[#180A1F] flex items-center justify-center shadow-lg shadow-amber-500/20 shrink-0">
            <Bike className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30">
                Canlı Sipariş
              </span>
              <span className="text-xs text-purple-200/75 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                {uyari.zaman}
              </span>
            </div>
            <h2 className="font-sans font-bold text-base text-white mt-1">Yeni Paket Mutfakta Hazır</h2>
          </div>
        </div>

        <div className="bg-[#110415] rounded-2xl p-4 border border-[#3E1646] space-y-3 mb-5">
          <div className="flex justify-between items-center pb-2.5 border-b border-purple-900/50">
            <span className="text-xs text-purple-200/75">Sipariş Takip Kodu</span>
            <span className="text-sm font-mono font-bold text-amber-400">#{uyari.siparisKodu}</span>
          </div>

          <div className="flex items-start gap-2.5 text-xs text-purple-100">
            <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{uyari.adres}</span>
          </div>

          <div className="flex justify-between items-center pt-2.5 border-t border-purple-900/50">
            <span className="text-xs text-purple-200/75">Toplam Sipariş Tutarı</span>
            <span className="text-base font-bold font-mono text-emerald-400">{uyari.tutar} ₺</span>
          </div>
        </div>

        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={onKapat}
            className="flex-1 py-3 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-purple-100 font-semibold text-xs transition-colors cursor-pointer"
          >
            Sonra Bak
          </button>
          <button
            type="button"
            onClick={() => {
              onPaketAl(uyari.id);
              onKapat();
            }}
            className="flex-2 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-[#180A1F] font-black text-xs shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <span>Hemen Üzerime Al</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
