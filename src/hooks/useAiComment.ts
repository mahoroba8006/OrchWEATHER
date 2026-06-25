// src/hooks/useAiComment.ts
//
// AI コメントのオーケストレーション。
// 1. 予報・警報データから入力ペイロード＋ハッシュを計算
// 2. Firestore キャッシュ確認（ヒット → 即返す・API 呼ばない）
// 3. ミス → Pages Function 呼出 → 結果を Firestore に書き戻す
// 非ブロッキング: エラー時は静かに失敗し comment = null（天気表示を邪魔しない）
//
// 【無限ループ防止の要】
// 呼び出し元の WeatherTab は filteredJmaWarning.items を毎レンダー .filter() で
// 再生成するため、warnings/forecast の「参照」は毎レンダー変わる。
// これを effect の依存に直接入れると、毎レンダー発火 → setComment(新オブジェクト)
// → 再レンダー → … の無限ループ（＋過剰な Firestore Read）になる。
// 対策: input/hash は本体で毎レンダー計算（純粋・安価）し、
//       effect の依存は「プリミティブの hash と uid」だけにする。
//       これにより、setLoading 等で再レンダーが起きても hash 不変なら
//       effect は再発火せず、in-flight リクエストも握り潰されない。

import { useState, useEffect, useRef } from 'react';
import type { ForecastData } from '../api/forecast';
import type { JmaWarningItem } from '../api/jmaWarning';
import { fetchAiComment, type AiCommentData } from '../api/aiComment';
import { buildAiCommentInput, hashAiCommentInput } from '../lib/aiCommentInput';
import { readAiCommentCache, writeAiCommentCache } from '../lib/aiCommentCache';

export function useAiComment(
  uid: string | null | undefined,
  locationName: string | null | undefined,
  forecast: ForecastData | null,
  warnings: JmaWarningItem[] | undefined,
) {
  const [comment, setComment] = useState<AiCommentData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 入力とハッシュを毎レンダー計算する純粋処理（findCalmWindows は O(72) で安価）。
  // 時刻は buildAiCommentInput 内で4時間バケットに丸めるため、hash は同一バケット内で
  // 安定し、4時間 TTL のキャッシュ（aiCommentCache.ts）が実効化する。
  const input =
    uid && locationName && forecast
      ? buildAiCommentInput(locationName, forecast, warnings ?? [])
      : null;
  const hash = input ? hashAiCommentInput(input) : null;

  // 最新 input を ref で保持。effect は hash でゲートし、本体は ref から読む
  // （input は参照不安定なので依存に入れない）。
  const inputRef = useRef(input);
  inputRef.current = input;

  useEffect(() => {
    if (!uid || !hash) {
      setComment(null);
      setLoading(false);
      return;
    }
    const currentInput = inputRef.current;
    if (!currentInput) return;

    let cancelled = false;

    const run = async () => {
      setError(null);
      // 1. キャッシュ確認
      try {
        const cached = await readAiCommentCache(uid, hash);
        if (cancelled) return;
        if (cached) {
          setComment(cached);
          // 直前の run がキャンセルされ loading=true のまま残るケースを確実に解消
          // （地点切替で fetch 中 → 切替先がキャッシュヒット のシーケンス対策）
          setLoading(false);
          return;
        }
      } catch {
        // キャッシュ読み取り失敗は無視して API へ進む
      }
      if (cancelled) return;

      // 2. ミス → Function 呼出
      setComment(null);
      setLoading(true);
      try {
        const data = await fetchAiComment(currentInput);
        if (cancelled) return;
        setComment(data);
        // 3. 書き戻し（失敗は致命的でない）
        try {
          await writeAiCommentCache(uid, hash, data);
        } catch {
          console.warn('[useAiComment] cache write failed');
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'AIコメントの取得に失敗しました');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => { cancelled = true; };
    // 依存はプリミティブのみ。input は inputRef 経由で読むため依存に含めない
  }, [uid, hash]);

  return { comment, loading, error };
}
