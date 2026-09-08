import { Check, Copy, X } from 'lucide-react';
import { useState } from 'react';
import type { InAppBrowserApp } from '../lib/inAppBrowser';
import { OpenInBrowserDiagram } from './OpenInBrowserDiagram';

type OpenInBrowserNoticeProps = { app: InAppBrowserApp; onDismiss: () => void };

async function copyUrl(url: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      return true;
    }
  } catch {
    // Fall through to the textarea method when Clipboard permission is unavailable.
  }
  const textarea = document.createElement('textarea');
  textarea.value = url;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  return copied;
}

export function OpenInBrowserNotice({ app, onDismiss }: OpenInBrowserNoticeProps) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const url = window.location.href;
  const handleCopy = async () => {
    try { setCopyState(await copyUrl(url) ? 'copied' : 'failed'); } catch { setCopyState('failed'); }
  };

  return (
    <div className="modal-overlay" role="presentation" style={{ padding: '1rem' }}>
      <section className="modal-content" role="dialog" aria-modal="true" aria-labelledby="open-in-browser-title" style={{ maxWidth: '440px', padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
          <div><p style={{ margin: 0, color: 'var(--accent-color)', fontSize: '0.8rem', fontWeight: 800 }}>表示についてのお知らせ</p><h2 id="open-in-browser-title" style={{ margin: '0.25rem 0 0', fontSize: '1.35rem' }}>ブラウザで開くお願い</h2></div>
          <button type="button" className="secondary" aria-label="閉じる" onClick={onDismiss} style={{ minWidth: 36, padding: '0.4rem' }}><X size={18} /></button>
        </div>
        <p style={{ lineHeight: 1.7, color: 'var(--text-secondary)', margin: '1rem 0' }}>{app}のアプリ内ブラウザでは、一部の機能が正しく動かないことがあります。下のURLをコピーし、ChromeやSafariなどのブラウザで開いてください。</p>
        <OpenInBrowserDiagram app={app} />
        <p style={{ margin: '1rem 0 0.35rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>このページのURL</p>
        <div style={{ padding: '0.65rem', border: '1px solid var(--card-border)', borderRadius: 'var(--radius-sm)', fontSize: '0.78rem', overflowWrap: 'anywhere', background: '#fff', color: 'var(--text-secondary)' }}>{url}</div>
        <button type="button" onClick={handleCopy} style={{ width: '100%', marginTop: '0.65rem' }}>{copyState === 'copied' ? <Check size={17} /> : <Copy size={17} />}{copyState === 'copied' ? 'コピーしました' : 'URLをコピー'}</button>
        <p style={{ margin: '0.65rem 0 0', fontSize: '0.78rem', color: copyState === 'failed' ? '#b91c1c' : 'var(--text-tertiary)', lineHeight: 1.55 }}>{copyState === 'failed' ? 'コピーできませんでした。上のURLを長押ししてコピーしてください。' : 'コピーできない場合は、URLを長押ししてコピーしてください。'}</p>
        <button type="button" className="secondary" onClick={onDismiss} style={{ width: '100%', marginTop: '1rem' }}>あとで</button>
      </section>
    </div>
  );
}
