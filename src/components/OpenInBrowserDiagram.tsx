import { ArrowRight, Globe, Menu } from 'lucide-react';
import type { InAppBrowserApp } from '../lib/inAppBrowser';

type OpenInBrowserDiagramProps = {
  app: InAppBrowserApp;
};

export function OpenInBrowserDiagram({ app }: OpenInBrowserDiagramProps) {
  return (
    <div
      aria-hidden="true"
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.65rem', padding: '0.8rem', borderRadius: 'var(--radius-md)', background: 'var(--accent-soft)', color: 'var(--accent)', fontWeight: 700 }}
    >
      <span style={{ padding: '0.45rem 0.65rem', background: '#fff', borderRadius: '0.55rem', boxShadow: 'var(--shadow-card)' }}>{app}</span>
      <ArrowRight size={20} />
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.65rem', background: '#fff', borderRadius: '0.55rem', boxShadow: 'var(--shadow-card)' }}><Menu size={17} /> メニュー</span>
      <ArrowRight size={20} />
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.65rem', background: '#fff', borderRadius: '0.55rem', boxShadow: 'var(--shadow-card)' }}><Globe size={17} /> ブラウザで開く</span>
    </div>
  );
}
