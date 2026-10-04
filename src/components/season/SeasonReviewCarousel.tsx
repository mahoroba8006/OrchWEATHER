// 節気ふりかえりカードを左右にスワイプして遡るカルーセル（左が古く、右が最新）。
// スクロールスナップに任せ、現在位置はスクロール量から求める。
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { SeasonReview } from '../../lib/seasonReview';
import { logSeasonCardBrowse } from '../../lib/analytics';
import { SeasonReviewCard } from './SeasonReviewCard';
import './season.css';

interface Props {
  reviews: SeasonReview[];
  onIndexChange?: (index: number) => void;
}

export function SeasonReviewCarousel({ reviews, onIndexChange }: Props) {
  const n = reviews.length;
  const trackRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(n - 1);

  // 最新（右端）から始める。アニメーションなしで即座に置く
  useLayoutEffect(() => {
    const track = trackRef.current;
    if (track) track.scrollLeft = track.scrollWidth;
    onIndexChange?.(n - 1);
    // マウント時のみ（件数が変わる＝別地点では親が作り直す）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const change = useCallback((next: number) => {
    setIndex(next);
    onIndexChange?.(next);
    const back = n - 1 - next;
    if (back > 0) logSeasonCardBrowse(back);
  }, [n, onIndexChange]);

  const handleScroll = () => {
    const track = trackRef.current;
    if (!track || track.clientWidth === 0) return;
    const next = Math.min(n - 1, Math.max(0, Math.round(track.scrollLeft / track.clientWidth)));
    if (next !== index) change(next);
  };

  const goTo = (i: number) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollTo({ left: i * track.clientWidth, behavior: reduce ? 'auto' : 'smooth' });
  };

  if (n === 0) return null;
  if (n === 1) return <SeasonReviewCard review={reviews[0]} source="sheet" />;

  return (
    <div className="season-carousel">
      <div
        ref={trackRef}
        className="season-carousel__track"
        role="region"
        aria-roledescription="カルーセル"
        aria-label="節気のふりかえり"
        onScroll={handleScroll}
      >
        {reviews.map((r, i) => (
          <div
            key={r.range.index}
            className="season-carousel__slide"
            role="group"
            aria-roledescription="スライド"
            aria-label={`${i + 1}/${n} ${r.range.name}`}
          >
            <SeasonReviewCard review={r} source="sheet" />
          </div>
        ))}
      </div>
      <div className="season-carousel__nav">
        <button type="button" className="season-carousel__arrow" aria-label="前の節気" disabled={index <= 0} onClick={() => goTo(index - 1)}>
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <div className="season-carousel__dots">
          {reviews.map((r, i) => (
            <button
              key={r.range.index}
              type="button"
              className="season-carousel__dot"
              aria-label={`${r.range.name}のふりかえり（${i + 1}/${n}）`}
              aria-current={i === index ? 'true' : undefined}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
        <button type="button" className="season-carousel__arrow" aria-label="次の節気" disabled={index >= n - 1} onClick={() => goTo(index + 1)}>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
