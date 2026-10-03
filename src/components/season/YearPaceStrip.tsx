// 空もようのヒーロー直下に常設する「今年のあゆみ」の帯。
// 取得中は同じ高さの骨組みで場所を確保し、予報が後から押し下げられないようにする。
import { Skeleton } from '../ui/Skeleton';
import type { SeasonState } from '../../hooks/useSeasonReview';
import './season.css';

export function YearPaceStrip({ state }: { state: SeasonState }) {
  if (state.status === 'loading') {
    return (
      <div role="status" aria-label="今年のあゆみを集計中">
        <Skeleton height={52} radius="var(--radius-md)" />
      </div>
    );
  }
  if (state.status !== 'ready' || !state.view.pace) return null;
  const { label, text } = state.view.pace;
  return (
    <section className="season-strip" aria-label={label}>
      <span className="season-strip__label">{label}</span>
      <span className="season-strip__text">{text}</span>
    </section>
  );
}
