import React, { useState } from 'react';
import { Volume2, VolumeX, Bell } from 'lucide-react';

interface TezgahBildirimCubuguProps {
  panelTuru?: 'kurye' | 'mutfak' | 'patron';
  onSesTesti?: () => void;
}

export const TezgahBildirimCubugu: React.FC<TezgahBildirimCubuguProps> = ({
  panelTuru = 'kurye',
  onSesTesti
}) => {
  const [sesAcik, setSesAcik] = useState(true);
  const [testCaliniyor, setTestCaliniyor] = useState(false);

  const sesCal = () => {
    setTestCaliniyor(true);
    if (onSesTesti) {
      onSesTesti();
    }
    setTimeout(() => {
      setTestCaliniyor(false);
    }, 1500);
  };

  return (
    <div className="flex items-center gap-1.5 bg-[#1D0A20] border border-[#3E1646] rounded-xl px-2 py-1 text-xs text-purple-100">
      <button
        type="button"
        onClick={() => setSesAcik(!sesAcik)}
        className="p-1 rounded-lg hover:bg-[#2D1233] text-purple-200 hover:text-white transition-colors cursor-pointer"
        title={sesAcik ? 'Sesli Uyarı Açık' : 'Sesli Uyarı Sessizde'}
      >
        {sesAcik ? (
          <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
        ) : (
          <VolumeX className="w-3.5 h-3.5 text-rose-400" />
        )}
      </button>

      <span className="text-[11px] font-medium text-purple-200 hidden md:inline">
        {panelTuru === 'kurye' ? 'Korna' : 'Alarm'}
      </span>

      <button
        type="button"
        onClick={sesCal}
        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
          testCaliniyor
            ? 'bg-amber-500 text-black border-amber-400 animate-pulse'
            : 'bg-[#2B1032] hover:bg-[#3A1642] text-amber-300 border-[#4D1E57]'
        }`}
        title="Ses ve Korna Testi Yap"
      >
        <Bell className="w-3 h-3 text-amber-400" />
        <span>{testCaliniyor ? 'Çalıyor' : 'Test'}</span>
      </button>
    </div>
  );
};
