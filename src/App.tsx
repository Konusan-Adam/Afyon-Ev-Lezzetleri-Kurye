import React from 'react';
import { TemaSaglayici } from './OrtakHavuz/TemaHafizasi';
import { AramaVeFiltreSaglayici } from './OrtakHavuz/AramaVeFiltreHafizasi';
import { KullaniciSaglayici, kullaniciHafizasiKullan } from './OrtakHavuz/KullaniciHafizasi';
import { SepetSaglayici } from './OrtakHavuz/SepetHafizasi';
import { OrtakSepetSaglayici } from './OrtakHavuz/OrtakSepetHafizasi';
import { TeslimatSaglayici } from './OrtakHavuz/TeslimatHafizasi';
import { OzelOzelliklerSaglayici } from './OrtakHavuz/OzelOzelliklerHafizasi';
import { OnSiparisSaglayici } from './OrtakHavuz/OnSiparisHafizasi';
import { KuryePaneli } from './VitrinOdasi/KuryePaneli/KuryePaneli';
import { KuryeGirisEkrani } from './VitrinOdasi/KuryePaneli/KuryeGirisEkrani';

const KuryeUygulamaIcerigi: React.FC = () => {
  const { aktifKullanici } = kullaniciHafizasiKullan();

  if (!aktifKullanici || aktifKullanici.rol !== 'kurye') {
    return <KuryeGirisEkrani />;
  }

  return <KuryePaneli />;
};

export default function App() {
  return (
    <TemaSaglayici>
      <AramaVeFiltreSaglayici>
        <KullaniciSaglayici>
          <SepetSaglayici>
            <TeslimatSaglayici>
              <OrtakSepetSaglayici>
                <OzelOzelliklerSaglayici>
                  <OnSiparisSaglayici>
                    <main className="min-h-screen bg-[#0C020E]">
                      <KuryeUygulamaIcerigi />
                    </main>
                  </OnSiparisSaglayici>
                </OzelOzelliklerSaglayici>
              </OrtakSepetSaglayici>
            </TeslimatSaglayici>
          </SepetSaglayici>
        </KullaniciSaglayici>
      </AramaVeFiltreSaglayici>
    </TemaSaglayici>
  );
}
