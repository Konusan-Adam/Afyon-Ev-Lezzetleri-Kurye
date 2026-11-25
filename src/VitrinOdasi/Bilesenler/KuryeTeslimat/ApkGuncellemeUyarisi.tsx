import React from 'react';
import { Download, Sparkles, X } from 'lucide-react';
import { YeniApkSurumBilgisi } from '@/src/MalzemeCekmeceleri/AndroidKopru/useApkGuncelleme';

interface ApkGuncellemeUyarisiProps {
  surumBilgisi: YeniApkSurumBilgisi;
  indiriliyor: boolean;
  hataMesaji?: string;
  onSimdiGuncelle: () => void;
  onKapat: () => void;
}

export const ApkGuncellemeUyarisi: React.FC<ApkGuncellemeUyarisiProps> = ({
  surumBilgisi,
  indiriliyor,
  hataMesaji,
  onSimdiGuncelle,
  onKapat
}) => {
  return (
    <div className="rounded-2xl bg-gradient-to-r from-[#260E2A] via-[#1D0A20] to-[#2B1032] border border-amber-500/45 p-3.5 sm:p-4 shadow-lg font-sans">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>

          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-sans text-xs sm:text-sm font-extrabold text-white">
                Yeni Afyon Kurye APK Güncellemesi Hazır
              </h4>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 font-mono font-bold text-[10px]">
                v{surumBilgisi.surumAdi}
              </span>
            </div>
            <p className="text-[11px] text-purple-200/80 leading-relaxed">
              {surumBilgisi.aciklama || 'Yeni sürümü tek dokunuşla indirip cihazınıza kurabilirsiniz.'}
              {surumBilgisi.yayinTarihiMetni ? ` (${surumBilgisi.yayinTarihiMetni})` : ''}
            </p>
            {hataMesaji && (
              <p className="text-[11px] text-rose-300 font-semibold">{hataMesaji}</p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onKapat}
          className="w-7 h-7 rounded-lg bg-[#140519] hover:bg-[#34123F] text-purple-300 hover:text-white border border-[#4B1D55] flex items-center justify-center cursor-pointer shrink-0 transition-all"
          title="Kapat"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onKapat}
          className="px-3 py-1.5 rounded-xl bg-[#140519] hover:bg-[#290F30] border border-[#4B1D55] text-purple-200 text-xs font-semibold cursor-pointer transition-all"
        >
          Daha Sonra
        </button>
        <button
          type="button"
          disabled={indiriliyor}
          onClick={onSimdiGuncelle}
          className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-[#18071C] text-xs font-black shadow-md shadow-amber-500/20 flex items-center gap-1.5 cursor-pointer transition-all disabled:opacity-60"
        >
          <Download className="w-3.5 h-3.5" />
          <span>{indiriliyor ? 'İndiriliyor...' : 'Şimdi Güncelle'}</span>
        </button>
      </div>
    </div>
  );
};
