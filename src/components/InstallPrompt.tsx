import { Download, Share, X } from 'lucide-react';
import { useRef } from 'react';
import { useGuidanceModalFocus } from './useGuidanceModalFocus';

type InstallPromptProps = { platform: 'ios' | 'android'; promptError: boolean; onInstall: () => void; onDismiss: () => void };

export function InstallPrompt({ platform, promptError, onInstall, onDismiss }: InstallPromptProps) {
  const isIos = platform === 'ios';
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  useGuidanceModalFocus(dialogRef, closeButtonRef);
  return (
    <div className="modal-overlay" role="presentation" style={{ padding: '1rem' }}>
      <section ref={dialogRef} className="modal-content" role="dialog" aria-modal="true" aria-labelledby="install-prompt-title" tabIndex={-1} style={{ maxWidth: '440px', padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
          <div><p style={{ margin: 0, color: 'var(--accent-color)', fontSize: '0.8rem', fontWeight: 800 }}>すぐ開けるように</p><h2 id="install-prompt-title" style={{ margin: '0.25rem 0 0', fontSize: '1.35rem' }}>ホーム画面に追加</h2></div>
          <button ref={closeButtonRef} type="button" className="secondary" aria-label="閉じる" onClick={onDismiss} style={{ minWidth: 36, padding: '0.4rem' }}><X size={18} /></button>
        </div>
        {isIos ? <div style={{ marginTop: '1rem', padding: '1rem', borderRadius: 'var(--radius-md)', background: 'var(--accent-light)', lineHeight: 1.75 }}><Share size={21} style={{ verticalAlign: 'text-bottom', marginRight: '0.35rem', color: 'var(--accent-color)' }} /><strong>共有ボタン → ホーム画面に追加</strong><p style={{ margin: '0.55rem 0 0', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>Safariの共有メニューから追加すると、次回からホーム画面のアイコンで開けます。</p></div> : promptError ? <p style={{ margin: '1rem 0', lineHeight: 1.7, color: 'var(--text-secondary)' }}>インストール画面を開けませんでした。ブラウザのメニューから、あとでお試しください。</p> : <p style={{ margin: '1rem 0', lineHeight: 1.7, color: 'var(--text-secondary)' }}>ホーム画面に追加すると、次回からアプリのようにすぐ開けます。</p>}
        {!isIos && !promptError && <button type="button" onClick={onInstall} style={{ width: '100%', marginTop: '0.25rem' }}><Download size={18} />ホーム画面に追加</button>}
        <button type="button" className="secondary" onClick={onDismiss} style={{ width: '100%', marginTop: '0.7rem' }}>あとで</button>
      </section>
    </div>
  );
}
