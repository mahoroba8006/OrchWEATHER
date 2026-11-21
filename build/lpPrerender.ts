// LP の本文を最初の HTML に入れる（SEO・2026-11-21）。
// ビルド時に LP を React の renderToString で HTML にし、index.html の <div id="lp-static"> に入れる。
// あわせて LP が使う CSS を head で読み、sitemap.xml のトップの lastmod をビルド日（日本時間）にする。
// JS を実行しない検索エンジン・SNS にも LP の見出しと本文が見え、初めての人には LP がすぐ出る。
// 入れ替え（本物の LP・アプリの画面が出たら消す）は src/lib/lpStatic.ts。
import { createServer, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const LP_MODULE = 'src/components/LandingPage.tsx';
const SLOT = '<div id="lp-static"></div>';

/** ビルドした日（日本時間）を YYYY-MM-DD で */
export function buildDateJst(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(now);
}

/** sitemap のトップ（https://…/）の lastmod だけを書き換える（規約類のページは触らない） */
export function setTopLastmod(xml: string, date: string): string {
  return xml.replace(
    /(<loc>https:\/\/[^/<]+\/<\/loc>\s*<lastmod>)[^<]*(<\/lastmod>)/,
    `$1${date}$2`,
  );
}

/** renderToString の先頭に出る <link rel="preload"> を本文から取り出す（head へ移す） */
export function splitPreloads(html: string): { preloads: string[]; body: string } {
  const preloads: string[] = [];
  let body = html;
  const re = /^<link rel="preload"[^>]*\/>/;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    preloads.push(m[0]);
    body = body.slice(m[0].length);
  }
  return { preloads, body };
}

/**
 * 飾りの絵（aria-hidden の SVG）のうち大きいものは中身を省き、枠（viewBox・幅・高さ）だけ残す。
 * 節気の絵24枚が LP の HTML の約85%を占めるため（検索には関係なく、本物の LP に入れ替わると出る）。
 * 枠を残すので、入れ替えの前後で並びはずれない。
 */
export function slimDecorativeSvgs(html: string, minBytes = 2000): string {
  return html.replace(/(<svg\b[^>]*aria-hidden="true"[^>]*>)([\s\S]*?)(<\/svg>)/g, (all, open: string, _inner: string, close: string) =>
    Buffer.byteLength(all) >= minBytes ? open + close : all,
  );
}

/** index.html の空の枠に LP を入れる。枠が無ければ失敗させる（気づかず SEO が外れるのを防ぐ） */
export function injectLp(indexHtml: string, lpHtml: string): string {
  if (!indexHtml.includes(SLOT)) throw new Error(`[lp-prerender] index.html に ${SLOT} がありません`);
  return indexHtml.replace(SLOT, `<div id="lp-static">${lpHtml}</div>`);
}

/** ビルド時に LP を描く。firebase・計測はログイン処理と計測用なので空の差し替えにする */
async function renderLp(root: string): Promise<string> {
  const stub = (f: string) => path.join(root, 'src/prerender', f);
  const server = await createServer({
    root,
    configFile: false,
    logLevel: 'error',
    appType: 'custom',
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
    plugins: [react()],
    resolve: {
      alias: [
        { find: /^(\.\.\/)+lib\/firebase$/, replacement: stub('firebaseStub.ts') },
        { find: /^(\.\.\/)+lib\/analytics$/, replacement: stub('analyticsStub.ts') },
        { find: /^firebase\/auth$/, replacement: stub('firebaseStub.ts') },
      ],
    },
  });
  try {
    const mod = (await server.ssrLoadModule('/src/prerender/renderLp.tsx')) as { renderLp: () => string };
    return mod.renderLp();
  } finally {
    await server.close();
  }
}

type ChunkLike = { type: 'chunk'; facadeModuleId: string | null; imports: string[]; viteMetadata?: { importedCss: Set<string> } };

/** LP の部品（動的に読む塊）とそれが読む塊の CSS を集める */
export function collectLpCss(bundle: Record<string, { type: string }>, root: string): string[] {
  const chunks = Object.entries(bundle).filter(([, c]) => c.type === 'chunk') as [string, ChunkLike][];
  const target = path.join(root, LP_MODULE).split(path.sep).join('/');
  const entry = chunks.find(([, c]) => c.facadeModuleId?.split(path.sep).join('/') === target);
  if (!entry) throw new Error(`[lp-prerender] ${LP_MODULE} の塊が見つかりません`);
  const byName = new Map(chunks);
  const css = new Set<string>();
  const seen = new Set<string>();
  const walk = (name: string) => {
    if (seen.has(name)) return;
    seen.add(name);
    const c = byName.get(name);
    if (!c) return;
    c.viteMetadata?.importedCss.forEach((f) => css.add(f));
    c.imports.forEach(walk);
  };
  walk(entry[0]);
  return [...css];
}

export function lpPrerender(): Plugin {
  let root = process.cwd();
  let base = '/';
  let outDir = 'dist';
  let lp = { preloads: [] as string[], body: '' };
  return {
    name: 'lp-prerender',
    apply: 'build',
    configResolved(c) {
      root = c.root;
      base = c.base;
      outDir = path.resolve(c.root, c.build.outDir);
    },
    async buildStart() {
      lp = splitPreloads(slimDecorativeSvgs(await renderLp(root)));
    },
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const css = ctx.bundle ? collectLpCss(ctx.bundle as Record<string, { type: string }>, root) : [];
        // アプリ本体の CSS など、すでに head で読んでいるものは足さない
        const links = css
          .filter((f) => !html.includes(`href="${base}${f}"`))
          .map((f) => `<link rel="stylesheet" crossorigin href="${base}${f}">`);
        return injectLp(html, lp.body).replace('</head>', `    ${[...links, ...lp.preloads].join('\n    ')}\n  </head>`);
      },
    },
    async closeBundle() {
      const file = path.join(outDir, 'sitemap.xml');
      const xml = await readFile(file, 'utf8').catch(() => null);
      if (xml) await writeFile(file, setTopLastmod(xml, buildDateJst()));
    },
  };
}
