import React, { useEffect, useRef, useState } from 'react';
import { Bike, CheckCircle2, FileCheck2, Wallet } from 'lucide-react';

export type KuryeSekmeTipi = 'aktif_paketler' | 'gecmis' | 'kazanc' | 'sozlesmeler';

export interface KuryeAltMenuProps {
  aktifSekme: KuryeSekmeTipi;
  onSekmeDegistir: (sekme: KuryeSekmeTipi) => void;
  aktifPaketSayisi: number;
  teslimEdilenSayisi: number;
}

export const KuryeAltMenu: React.FC<KuryeAltMenuProps> = ({
  aktifSekme,
  onSekmeDegistir,
  aktifPaketSayisi,
  teslimEdilenSayisi
}) => {
  const [gorunur, setGorunur] = useState(true);
  const sonKaydirmaYRef = useRef<number>(0);

  // Sekme değiştiğinde alt menü her zaman görünür olsun
  useEffect(() => {
    setGorunur(true);
  }, [aktifSekme]);

  // Yukarı kaydırırken görünür, aşağı kaydırırken gizlenir
  useEffect(() => {
    if (typeof window === 'undefined') return;

    sonKaydirmaYRef.current = window.scrollY;
    let islemde = false;

    const kaydirmaDinle = () => {
      if (islemde) return;
      islemde = true;

      window.requestAnimationFrame(() => {
        const guncelY = window.scrollY;
        const fark = guncelY - sonKaydirmaYRef.current;
        const sayfaDibindeMi =
          window.innerHeight + guncelY >= document.documentElement.scrollHeight - 24;

        if (guncelY <= 36 || sayfaDibindeMi) {
          setGorunur(true);
        } else if (fark > 8 && guncelY > 56) {
          setGorunur(false);
        } else if (fark < -6) {
          setGorunur(true);
        }

        sonKaydirmaYRef.current = guncelY;
        islemde = false;
      });
    };

    window.addEventListener('scroll', kaydirmaDinle, { passive: true });
    return () => {
      window.removeEventListener('scroll', kaydirmaDinle);
    };
  }, []);

  const ogeler: Array<{
    id: KuryeSekmeTipi;
    etiket: string;
    ikon: React.ReactNode;
    rozet?: number;
    rozetRenk?: string;
  }> = [
    {
      id: 'aktif_paketler',
      etiket: 'Dağıtım',
      ikon: <Bike className="w-4 h-4 shrink-0" />,
      rozet: aktifPaketSayisi,
      rozetRenk: 'bg-amber-400 text-[#180A1F]'
    },
    {
      id: 'gecmis',
      etiket: 'Teslimatlar',
      ikon: <CheckCircle2 className="w-4 h-4 shrink-0" />,
      rozet: teslimEdilenSayisi,
      rozetRenk: 'bg-emerald-400 text-[#0B1E16]'
    },
    {
      id: 'kazanc',
      etiket: 'Cüzdanım',
      ikon: <Wallet className="w-4 h-4 shrink-0" />
    },
    {
      id: 'sozlesmeler',
      etiket: 'Sözleşmeler',
      ikon: <FileCheck2 className="w-4 h-4 shrink-0" />
    }
  ];

  return (
    <nav
      aria-label="Kurye Alt Menü"
      className={`fixed bottom-3 left-3 right-3 sm:left-1/2 sm:-translate-x-1/2 sm:w-full sm:max-w-xl z-40 transition-all duration-300 ease-out ${
        gorunur
          ? 'translate-y-0 opacity-100'
          : 'translate-y-[140%] opacity-0 pointer-events-none'
      }`}
    >
      <div className="bg-[#180A1F]/95 backdrop-blur-xl border border-[#4B1D55] rounded-2xl p-1.5 shadow-2xl shadow-black/70 grid grid-cols-4 gap-1">
        {ogeler.map((oge) => {
          const secili = aktifSekme === oge.id;
          return (
            <button
              key={oge.id}
              type="button"
              onClick={() => onSekmeDegistir(oge.id)}
              className={`relative flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 py-2 px-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer ${
                secili
                  ? 'bg-gradient-to-r from-[#6D237A] to-[#4E1659] text-white border border-amber-400/40 shadow-md shadow-purple-950/60'
                  : 'text-purple-200/75 hover:text-white hover:bg-[#260F2E]'
              }`}
            >
              <span className={secili ? 'text-amber-300' : 'text-purple-300'}>
                {oge.ikon}
              </span>
              <span className="truncate">{oge.etiket}</span>
              {typeof oge.rozet === 'number' && oge.rozet > 0 && (
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-black leading-none ${
                    oge.rozetRenk || 'bg-amber-400 text-black'
                  }`}
                >
                  {oge.rozet}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
