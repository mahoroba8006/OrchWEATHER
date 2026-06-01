// src/hooks/useAiCustomComment.ts
//
// カスタムプロンプト AI コメントのオーケストレーション。
// useAiComment と同じ Firestore キャッシュ機構を使うが、
// キャッシュキーに customPrompt のハッシュを含めることで
// 標準4タブのキャッシュとは分離する（"c:" プレフィックスで衝突回避）。

import { useState, useEffect, useRef } from 'react';
import type { ForecastData } from '../api/forecast';
import type { JmaWarningItem } from '../api/jmaWarning';
import { fetchAiCustomComment } from '../api/aiComment';
import { buildAiCommentInput, hashAiCommentInput } from '../lib/aiCommentInput';
import { readAiCustomCache, writeAiCustomCache } from '../lib/aiCommentCache';

function hashString(s: string): string {
  let hash = 5381;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) + hash) ^ s.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

export function useAiCustomComment(
  uid: string | null | undefined,
  locationName: string | null | undefined,
  forecast: ForecastData | null,
  warnings: JmaWarningItem[] | undefined,
  customPrompt: string,
) {
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const enabled = !!uid && !!locationName && !!forecast && customPrompt.trim().length > 0;

  const input =
    enabled
      ? buildAiCommentInput(locationName!, forecast!, warnings ?? [])
      : null;

  const inputHash  = input ? hashAiCommentInput(input) : null;
  const promptHash = customPrompt.trim() ? hashString(customPrompt.trim()) : null;
  const hash = inputHash && promptHash ? `${inputHash}-${promptHash}` : null;

  const inputRef = useRef(input);
  inputRef.current = input;
  const promptRef = useRef(customPrompt);
  promptRef.current = customPrompt;

  useEffect(() => {
    if (!uid || !hash) {
      setText(null);
      setLoading(false);
      return;
    }
    const currentInput = inputRef.current;
    if (!currentInput) return;

    let cancelled = false;

    const run = async () => {
      try {
        const cached = await readAiCustomCache(uid, hash);
        if (cancelled) return;
        if (cached !== null) {
          setText(cached);
          setLoading(false);
          return;
        }
      } catch {
        // キャッシュ読み取り失敗は無視
      }
      if (cancelled) return;

      setText(null);
      setLoading(true);
      try {
        const result = await fetchAiCustomComment(currentInput, promptRef.current.trim());
        if (cancelled) return;
        setText(result);
        try {
          await writeAiCustomCache(uid, hash, result);
        } catch {
          console.warn('[useAiCustomComment] cache write failed');
        }
      } catch {
        // エラー時は静かに失敗（カード非表示）
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => { cancelled = true; };
  }, [uid, hash]);

  return { text, loading };
}
