// src/hooks/useSeasonReview.ts
//
// 季節のあしどり＋節気ふりかえりのデータ。予報の取得完了後に、必要な年の実績を取得する
// （予報と通信を取り合わない。archive API は同時接続数に上限があり、年ごとの並列取得は 429 になる）。
// 非ブロッキング: 失敗・計算不能は hidden（エラー表示しない）。
//
// 状態は「どの key の結果か」を持ち、描画時に key 比較で導出する（effect 内で同期 setState しない）。
// 地点切替直後は useForecast がまだ旧地点の予報を返すため、予報の取得地点が今の地点と一致するまで
// 取得を始めない（予報より先に走らせない・新予報の到着後に重複取得しない）。
import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchDailyActuals, hasStoredPast } from '../api/weather';
import { addDays } from '../lib/dateUtils';
import type { ForecastData } from '../api/forecast';
import {
  buildDayMap, computeSeasonView, fromArchive, fromForecastPast, requiredYears,
  type DayMap, type PaceOptions, type SeasonView,
} from '../lib/seasonReview';
import { jstDateString } from '../lib/sky';

export type SeasonState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'hidden' }
  | { status: 'ready'; view: SeasonView };

export function useSeasonReview(
  lat: number | null,
  lon: number | null,
  forecast: ForecastData | null,
  opts: PaceOptions,
): SeasonState {
  const today = jstDateString(new Date());
  const forecastMatches = forecast !== null && lat !== null && lon !== null && forecast.lat === lat && forecast.lon === lon;
  // key は地点と日付だけ。予報の手動更新（fetchedAt の変化）では取り直さない
  // （実績は fetchDailyActuals が6時間キャッシュ。骨組みに戻すとシートも閉じてしまう）
  const key = forecastMatches ? `${lat},${lon},${today}` : null;
  // 取得した実績（失敗時は null）。比べ方の設定が変わっても取り直さず、表示だけ計算し直す
  const [result, setResult] = useState<{ key: string; map: DayMap | null } | null>(null);

  // 最新の予報を ref で読む（参照は毎回変わりうるため effect の依存には key だけを使う）
  const forecastRef = useRef(forecast);
  forecastRef.current = forecast;

  useEffect(() => {
    if (key === null || lat === null || lon === null) return;
    const fill = fromForecastPast(forecastRef.current?.pastDaily ?? []);
    const build = (days: Awaited<ReturnType<typeof fetchDailyActuals>>) => buildDayMap(fromArchive(days), fill);
    const end = addDays(today, -1);
    const fullStart = `${requiredYears(today)[0]}-01-01`;
    // はじめての地点（過去年が端末に無い）は、まず去年分だけ取り寄せて「去年より」を先に出し、
    // 続けて残りの年を取り寄せて5年平均とふりかえりカードを加える（待ち時間を短く見せる）
    const staged = !hasStoredPast(lat, lon, fullStart, end);
    let cancelled = false;
    void (async () => {
      try {
        if (staged) {
          const first = await fetchDailyActuals(lat, lon, `${requiredYears(today, 1)[0]}-01-01`, end);
          if (cancelled) return;
          setResult({ key, map: build(first) });
        }
        const all = await fetchDailyActuals(lat, lon, fullStart, end);
        if (!cancelled) setResult({ key, map: build(all) });
      } catch {
        // 去年分まで出ていればそれを残し、何も無ければ隠す
        if (!cancelled) setResult(prev => (prev && prev.key === key && prev.map ? prev : { key, map: null }));
      }
    })();
    return () => { cancelled = true; };
    // key に lat・lon・today が含まれる
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const { baseTemp, gddDaysMin, reviewBase, startDates: { precip, sunshine, gdd } } = opts;
  const { precip: precipMode, gdd: gddMode, sunshine: sunshineMode } = opts.modes;
  const map = result && result.key === key ? result.map : null;
  const view = useMemo(
    () => (map
      ? computeSeasonView(map, today, {
        modes: { precip: precipMode, gdd: gddMode, sunshine: sunshineMode },
        baseTemp, gddDaysMin, reviewBase, startDates: { precip, sunshine, gdd },
      })
      : null),
    [map, today, precipMode, gddMode, sunshineMode, baseTemp, gddDaysMin, reviewBase, precip, sunshine, gdd],
  );

  if (lat === null || lon === null || !forecast) return { status: 'idle' };
  // 予報が今の地点に追いつくまで（key === null）と、取得中は骨組み
  if (key === null || !result || result.key !== key) return { status: 'loading' };
  return view ? { status: 'ready', view } : { status: 'hidden' };
}
