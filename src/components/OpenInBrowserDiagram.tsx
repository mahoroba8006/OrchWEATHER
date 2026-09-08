import { ArrowRight, Globe } from 'lucide-react';
import type { InAppBrowserApp } from '../lib/inAppBrowser';

type OpenInBrowserDiagramProps = {
  app: InAppBrowserApp;
};

export function OpenInBrowserDiagram({ app }: OpenInBrowserDiagramProps) {
  return (
    <div
      aria-hidden="true"
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.65rem', padding: '0.8rem', borderRadius: 'var(--radius-md)', background: 'var(--accent-light)', color: 'var(--accent-color)', fontWeight: 700 }}
    >
      <span style={{ padding: '0.45rem 0.65rem', background: '#fff', borderRadius: '0.55rem', boxShadow: 'var(--shadow-sm)' }}>{app}</span>
      <ArrowRight size={20} />
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.65rem', background: '#fff', borderRadius: '0.55rem', boxShadow: 'var(--shadow-sm)' }}><Globe size={17} /> ブラウザ</span>
    </div>
  );
}
