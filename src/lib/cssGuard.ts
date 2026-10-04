// 見た目の CSS が当たっていないときの自己診断と自動修復。
// 2026-10-04: 特定の端末で、カスタムドメインのトップだけ CSS が当たらず画面が崩れた（同じファイルでも他の
// アドレスや別ドメインでは正常、端末のデータ削除でも直らない）。原因の手がかりを集め、CSS を読み直して直す。
// React とは独立して動く（CSS が当たらない崩れた画面でも働く）。

import { logAppError } from './analytics';

/** index.css の :root で定義しているトークン。値が取れなければ CSS が当たっていない */
const PROBE_VAR = '--accent';

export function cssApplied(doc: Document = document): boolean {
  return getComputedStyle(doc.documentElement).getPropertyValue(PROBE_VAR).trim() !== '';
}

/** 原因の手がかり（短い1行ずつ） */
async function collectDiagnostics(): Promise<string[]> {
  const out: string[] = [];
  const links = [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')];
  out.push(`url=${location.pathname}${location.search} links=${links.map(l => l.getAttribute('href')).join(',') || 'なし'}`);
  out.push(`sheets=${[...document.styleSheets].map(s => { try { return `${s.href ?? 'inline'}:${s.cssRules.length}`; } catch { return `${s.href}:読めない`; } }).join(',') || 'なし'}`);
  const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  out.push(`nav=${nav?.type ?? '?'} sw=${navigator.serviceWorker?.controller ? 'あり' : 'なし'}`);
  const href = links[0]?.href;
  if (href) {
    const res = performance.getEntriesByName(href)[0] as (PerformanceResourceTiming & { responseStatus?: number }) | undefined;
    out.push(`css計測=${res ? `status:${res.responseStatus ?? '?'} size:${res.transferSize}/${res.decodedBodySize} ${Math.round(res.duration)}ms` : '記録なし'}`);
    try {
      const r = await fetch(href, { cache: 'no-store' });
      const text = await r.text();
      out.push(`css再取得=${r.status} ${r.headers.get('content-type') ?? '?'} ${text.length}B 先頭:${text.slice(0, 40).replace(/\s+/g, ' ')}`);
    } catch (e) {
      out.push(`css再取得=失敗 ${(e as Error).message}`);
    }
  }
  return out;
}

/** CSS を読み直す（キャッシュを避けるため問い合わせ文字列を付ける） */
function reloadStylesheets(): void {
  document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]').forEach(l => {
    const fresh = document.createElement('link');
    fresh.rel = 'stylesheet';
    fresh.href = `${l.href.split('?')[0]}?r=${Date.now()}`;
    document.head.appendChild(fresh);
  });
}

function showPanel(lines: string[], healed: boolean): void {
  const box = document.createElement('div');
  box.setAttribute('role', 'status');
  box.style.cssText = 'position:fixed;left:8px;right:8px;bottom:8px;z-index:2147483647;background:#fff8e1;color:#333;border:1px solid #e0b84c;border-radius:8px;padding:8px 10px;font:11px/1.5 monospace;white-space:pre-wrap;word-break:break-all;max-height:45vh;overflow:auto;box-shadow:0 2px 8px rgba(0,0,0,.2)';
  box.textContent = `【表示の診断】画面の見た目（CSS）が読み込まれていなかったため${healed ? '読み直しました' : '読み直しを試みましたが直りませんでした'}。お手数ですがこの欄のスクリーンショットを開発者に送ってください。\n${lines.join('\n')}`;
  const close = document.createElement('button');
  close.textContent = '閉じる';
  close.style.cssText = 'display:block;margin-top:6px;padding:4px 10px;font:12px sans-serif';
  close.onclick = () => box.remove();
  box.appendChild(close);
  document.body.appendChild(box);
}

/** ページの読み込み後に一度だけ確認する */
export function startCssGuard(): void {
  const check = async () => {
    if (cssApplied()) return;
    const lines = await collectDiagnostics();
    reloadStylesheets();
    await new Promise(r => setTimeout(r, 1500));
    const healed = cssApplied();
    logAppError(healed ? 'css-healed' : 'css-missing', new Error(lines.join(' | ')));
    showPanel(lines, healed);
  };
  const run = () => setTimeout(() => { void check(); }, 1000);
  if (document.readyState === 'complete') run();
  else window.addEventListener('load', run, { once: true });
}
