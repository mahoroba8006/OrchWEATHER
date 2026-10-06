// src/components/lp/sceneStore.ts
// 背景（SkyScene）が計算した進み具合 p を、見出し帯の時刻・節気の目盛りへ配る。
// 再描画を起こさず、受け取り側が DOM を直接書き換える前提。
type Listener = (p: number) => void;
const listeners = new Set<Listener>();
let last = 0;

export function publishScene(p: number): void {
  last = p;
  listeners.forEach((l) => l(p));
}

/** 登録時に今の値を1回渡す。戻り値で登録を外す */
export function subscribeScene(l: Listener): () => void {
  listeners.add(l);
  l(last);
  return () => {
    listeners.delete(l);
  };
}
