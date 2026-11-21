// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { buildDateJst, collectLpCss, injectLp, setTopLastmod, slimDecorativeSvgs, splitPreloads } from './lpPrerender';

describe('injectLp', () => {
  it('空の枠に LP を入れる', () => {
    const out = injectLp('<body><div id="lp-static"></div><div id="root"></div></body>', '<main>LP</main>');
    expect(out).toBe('<body><div id="lp-static"><main>LP</main></div><div id="root"></div></body>');
  });
  it('枠が無ければ失敗させる（気づかず LP が外れるのを防ぐ）', () => {
    expect(() => injectLp('<div id="root"></div>', 'x')).toThrow(/lp-static/);
  });
});

describe('splitPreloads', () => {
  it('先頭の preload を本文から取り出す', () => {
    const r = splitPreloads('<link rel="preload" as="image" href="/a.svg"/><link rel="preload" as="image" href="/b.webp"/><div>本文</div>');
    expect(r.preloads).toEqual(['<link rel="preload" as="image" href="/a.svg"/>', '<link rel="preload" as="image" href="/b.webp"/>']);
    expect(r.body).toBe('<div>本文</div>');
  });
});

describe('slimDecorativeSvgs', () => {
  it('大きな飾りの絵は枠だけ残し、小さい絵と読み上げ対象の絵はそのまま', () => {
    const big = `<svg viewBox="0 0 64 64" width="72" aria-hidden="true">${'<path d="M0 0"/>'.repeat(200)}</svg>`;
    const small = '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M0 0"/></svg>';
    const labeled = `<svg viewBox="0 0 64 64" role="img">${'<path d="M0 0"/>'.repeat(200)}</svg>`;
    expect(slimDecorativeSvgs(big + small + labeled)).toBe('<svg viewBox="0 0 64 64" width="72" aria-hidden="true"></svg>' + small + labeled);
  });
});

describe('setTopLastmod', () => {
  it('トップだけをビルド日にし、規約類のページは変えない', () => {
    const xml = '<url><loc>https://weather.orch-app.com/</loc>\n    <lastmod>2026-07-14</lastmod></url><url><loc>https://weather.orch-app.com/contact</loc>\n    <lastmod>2026-07-14</lastmod></url>';
    const out = setTopLastmod(xml, '2026-11-21');
    expect(out).toContain('<loc>https://weather.orch-app.com/</loc>\n    <lastmod>2026-11-21</lastmod>');
    expect(out).toContain('<loc>https://weather.orch-app.com/contact</loc>\n    <lastmod>2026-07-14</lastmod>');
  });
});

describe('buildDateJst', () => {
  it('日本時間の日付（UTC 15時以降は翌日）', () => {
    expect(buildDateJst(new Date('2026-11-20T14:59:00Z'))).toBe('2026-11-20');
    expect(buildDateJst(new Date('2026-11-20T15:00:00Z'))).toBe('2026-11-21');
  });
});

describe('collectLpCss', () => {
  const root = '/app';
  const chunk = (facadeModuleId: string | null, imports: string[], css: string[]) => ({
    type: 'chunk', facadeModuleId, imports, viteMetadata: { importedCss: new Set(css) },
  });
  it('LP の塊と、それが読む塊の CSS を集める', () => {
    const bundle = {
      'index.js': chunk('/app/index.html', [], ['assets/index.css']),
      'LandingPage.js': chunk('/app/src/components/LandingPage.tsx', ['index.js', 'shared.js'], ['assets/LandingPage.css']),
      'shared.js': chunk(null, [], ['assets/shared.css']),
      'other.js': chunk('/app/src/other.tsx', [], ['assets/other.css']),
    };
    expect(collectLpCss(bundle, root).sort()).toEqual(['assets/LandingPage.css', 'assets/index.css', 'assets/shared.css']);
  });
  it('LP の塊が無ければ失敗させる', () => {
    expect(() => collectLpCss({}, root)).toThrow(/LandingPage/);
  });
});
