// アプリ全体の描画が止まったときの画面。真っ白にせず、原因（エラー内容）と立て直す手段を出す。
// 端末に残った古い保存データや古いファイル（Service Worker のキャッシュ）が原因のことがあるため、
// それらだけを消して読み直す手段を用意する（ログイン状態・ゲストの選択は消さない）。

/** 端末に保存している、作り直せるデータのキー（消しても次回取り直すだけ） */
const RESETTABLE_KEYS = (key: string) => key.startsWith('pastActuals:') || key === 'hiddenHourlyRows';

async function resetLocalData(): Promise<void> {
  try {
    Object.keys(localStorage).filter(RESETTABLE_KEYS).forEach(k => localStorage.removeItem(k));
  } catch {
    // 保存領域が使えない環境は何もしない
  }
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
    if ('caches' in window) {
      const names = await caches.keys();
      await Promise.all(names.map(n => caches.delete(n)));
    }
  } catch {
    // 消せなくても読み直しは行う
  }
}

export function AppErrorFallback({ error }: { error: Error | null }) {
  return (
    <div role="alert" style={{ maxWidth: 480, margin: '0 auto', padding: '3rem 1.25rem', color: 'var(--ink-1)', fontSize: '0.9rem', lineHeight: 1.7 }}>
      <h1 style={{ fontSize: '1.1rem', margin: '0 0 0.75rem' }}>表示中に問題が起きました</h1>
      <p style={{ margin: '0 0 0.75rem' }}>
        再読み込みしても直らないときは、端末の保存データを消して読み直してください（ログイン状態や地点の登録は消えません）。
      </p>
      {error && (
        <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: '0.75rem', color: 'var(--ink-3)', background: 'rgba(0,0,0,0.04)', padding: '0.5rem 0.75rem', borderRadius: 6, margin: '0 0 1rem' }}>
          {`${error.name}: ${error.message}`}
        </pre>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        <button type="button" className="ui-btn" onClick={() => window.location.reload()}>再読み込み</button>
        <button type="button" className="ui-btn" onClick={() => { void resetLocalData().then(() => window.location.reload()); }}>
          端末の保存データを消して再読み込み
        </button>
      </div>
    </div>
  );
}
