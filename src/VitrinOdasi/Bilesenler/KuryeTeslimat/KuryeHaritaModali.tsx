import React, { useEffect, useRef } from 'react';
import { X, Navigation, MapPin, ExternalLink, Clock } from 'lucide-react';
import L from 'leaflet';
import { haritaIkonlariOlustur } from '@/src/MalzemeCekmeceleri/CanliTakip/HaritaIkonlari';
import {
  gercekMesafeMetreHesapla,
  tahminiSureDakikaHesapla
} from '@/src/MalzemeCekmeceleri/CanliTakip/mesafeVeSureHesaplayici';

export interface KuryeHaritaModaliProps {
  paket: any;
  kuryeKonum?: { enlem: number; boylam: number; mahalle?: string } | null;
  onKapat: () => void;
}

export const KuryeHaritaModali: React.FC<KuryeHaritaModaliProps> = ({
  paket,
  kuryeKonum,
  onKapat
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  // Afyonkarahisar merkez varsayılan koordinatları
  const AFYON_MERKEZ = { enlem: 38.7569, boylam: 30.5387 };

  // Müşteri koordinatları
  const musteriEnlem = paket?.musteri_konum?.enlem || paket?.enlem || 38.7612;
  const musteriBoylam = paket?.musteri_konum?.boylam || paket?.boylam || 30.5420;

  // Kurye koordinatları
  const kuryeEnlem = kuryeKonum?.enlem || AFYON_MERKEZ.enlem;
  const kuryeBoylam = kuryeKonum?.boylam || AFYON_MERKEZ.boylam;

  const mesafeMetre = gercekMesafeMetreHesapla(kuryeEnlem, kuryeBoylam, musteriEnlem, musteriBoylam);
  const tahminiSureDk = tahminiSureDakikaHesapla(mesafeMetre);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Harita başlat
    const map = L.map(mapContainerRef.current).setView([kuryeEnlem, kuryeBoylam], 14);
    mapInstanceRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    const { kuryeIkonu, musteriIkonu } = haritaIkonlariOlustur();

    // Kurye pini
    L.marker([kuryeEnlem, kuryeBoylam], { icon: kuryeIkonu })
      .addTo(map)
      .bindPopup('<b>🛵 Kurye Konumu</b>')
      .openPopup();

    // Müşteri pini
    L.marker([musteriEnlem, musteriBoylam], { icon: musteriIkonu })
      .addTo(map)
      .bindPopup(`<b>🏠 Müşteri: ${paket?.musteriAdi || paket?.musteri_adi || 'Teslimat Noktası'}</b>`);

    // Rota çizgisi
    const rotaCizgisi = L.polyline(
      [
        [kuryeEnlem, kuryeBoylam],
        [musteriEnlem, musteriBoylam]
      ],
      { color: '#DDAF53', weight: 4, dashArray: '6, 8', opacity: 0.9 }
    ).addTo(map);

    map.fitBounds(rotaCizgisi.getBounds(), { padding: [50, 50] });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [kuryeEnlem, kuryeBoylam, musteriEnlem, musteriBoylam, paket]);

  const navLink = `https://www.google.com/maps/dir/?api=1&destination=${musteriEnlem},${musteriBoylam}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-3xl bg-[#140618] border border-purple-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Başlık Barı */}
        <div className="px-5 py-4 bg-[#230B2A] border-b border-purple-800/60 flex items-center justify-between text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500 text-black flex items-center justify-center font-bold">
              <Navigation className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-black text-sm text-amber-300">
                Canlı Teslimat Rotası — #{paket?.siparis_kodu || paket?.siparisKodu || paket?.id}
              </h3>
              <p className="text-[11px] text-gray-400">
                {paket?.teslimat_adresi_metni || paket?.teslimatAdresiMetni || paket?.adres || 'Afyonkarahisar'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onKapat}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Harita Alanı */}
        <div className="relative flex-1 min-h-[380px] bg-stone-900">
          <div ref={mapContainerRef} className="w-full h-full min-h-[380px]" />
          
          {/* Bilgi Kartı */}
          <div className="absolute top-4 left-4 z-[1000] bg-black/85 backdrop-blur-md border border-purple-700/80 rounded-2xl p-3 shadow-xl text-white flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5 text-amber-300 font-bold">
              <Navigation className="w-3.5 h-3.5" />
              <span>{mesafeMetre > 1000 ? `${(mesafeMetre / 1000).toFixed(1)} km` : `${mesafeMetre} m`}</span>
            </div>
            <div className="h-4 w-px bg-purple-700/60" />
            <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
              <Clock className="w-3.5 h-3.5" />
              <span>~{tahminiSureDk} dk</span>
            </div>
          </div>
        </div>

        {/* Alt Aksiyon Barı */}
        <div className="p-4 bg-[#1C0922] border-t border-purple-800/60 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-xs text-gray-300">
            <MapPin className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold text-white">{paket?.musteriAdi || paket?.musteri_adi || 'Müşteri'}</span>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={navLink}
              target="_blank"
              rel="noopener noreferrer"
              className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-black font-black text-xs flex items-center gap-2 shadow-md transition-all cursor-pointer"
            >
              <span>Google Haritalarda Aç</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <button
              type="button"
              onClick={onKapat}
              className="py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-gray-300 font-bold text-xs transition-colors"
            >
              Kapat
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
