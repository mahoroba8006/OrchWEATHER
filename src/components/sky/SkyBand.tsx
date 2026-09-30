// 空くらべ・空しらべ上部の低い空帯（画面タイトル）。
import { fallbackSky, useSkyStore } from '../../skyStore';
import './sky.css';

export function SkyBand({ title }: { title: string }) {
  const sky = useSkyStore(s => s.sky) ?? fallbackSky();
  return (
    <div className="sky-band" style={{ background: `linear-gradient(180deg, ${sky.top} 0%, ${sky.bottom} 100%)` }}>
      <div className="sky-band__inner">
        <h1 className="sky-band__title">{title}</h1>
      </div>
    </div>
  );
}
