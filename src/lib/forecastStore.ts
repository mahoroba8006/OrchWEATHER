// src/lib/forecastStore.ts
// 最後に取れた予報を端末に保存する（地点ごと・新しい順に最大 MAX_ENTRIES 地点）。
// アプリを開いたら通信を待たずにまずこれを見せ、裏で取り直す。電波が悪くて取り直しに
// 失敗しても画面が空にならない。
//
// ForecastData の形を変えたら KEY の版を上げること（古い形のデータを読ませない）。

import type { ForecastData } from '../api/forecast';

const KEY = 'orch.forecast.v1';
const MAX_ENTRIES = 3;
/** これより古い予報は出さない（時間別の表の始まりが取得時刻基準のため、古すぎると今日がずれる） */
export const STORED_FORECAST_MAX_AGE_MS = 12 * 60 * 60 * 1000;

type Entry = { key: string; data: ForecastData };

const locKey = (lat: number, lon: number) => `${lat},${lon}`;

function readAll(): Entry[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function isForecastShape(d: unknown): d is ForecastData {
  const f = d as ForecastData | null;
  return !!f && Array.isArray(f.hourly) && Array.isArray(f.daily) && Array.isArray(f.pastDaily)
    && typeof f.fetchedAt === 'number';
}

/** 保存済みの予報（12時間以内のもの）。無ければ null */
export function loadStoredForecast(lat: number, lon: number, now = Date.now()): ForecastData | null {
  const hit = readAll().find(e => e?.key === locKey(lat, lon));
  if (!hit || !isForecastShape(hit.data)) return null;
  if (now - hit.data.fetchedAt > STORED_FORECAST_MAX_AGE_MS) return null;
  return hit.data;
}

/** 予報を保存する（同じ地点は置き換え、古い地点から捨てる）。保存できなくても黙って続ける */
export function saveStoredForecast(data: ForecastData, lat: number, lon: number): void {
  const key = locKey(lat, lon);
  const list = [{ key, data }, ...readAll().filter(e => e?.key !== key)].slice(0, MAX_ENTRIES);
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // 容量超過・プライベートブラウズなど。保存は便利機能なので失敗しても表示には影響させない
  }
}
