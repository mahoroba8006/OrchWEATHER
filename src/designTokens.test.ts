import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { contrastRatio } from './lib/contrast';

const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');

/** `:root { ... }` の最初のブロックから `--name: value;` を取り出す */
const rootBlock = css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {')));
const token = (name: string): string => {
  const m = new RegExp(`${name}:\\s*([^;]+);`).exec(rootBlock);
  if (!m) throw new Error(`token ${name} not found in :root`);
  return m[1].trim();
};

/** セレクタ直後の `{ ... }` ブロック本文を返す（完全一致セレクタ） */
const ruleBody = (selector: string): string => {
  const start = css.indexOf(`\n${selector} {`);
  if (start < 0) throw new Error(`rule ${selector} not found`);
  const open = css.indexOf('{', start);
  return css.slice(open + 1, css.indexOf('}', open));
};

describe('design tokens', () => {
  it('defines the opaque surface, ink and single accent palette', () => {
    expect(token('--surface-ground')).toBe('#F4F3EF');
    expect(token('--surface-card')).toBe('#FFFFFF');
    expect(token('--surface-sunken')).toBe('#ECEAE4');
    expect(token('--ink-1')).toBe('#17191C');
    expect(token('--ink-2')).toBe('#4A4F57');
    expect(token('--ink-3')).toBe('#62676F');
    expect(token('--accent')).toBe('#0E6B65');
    expect(token('--accent-press')).toBe('#0A5550');
  });

  it('keeps legacy variable names as aliases to the new tokens', () => {
    expect(token('--accent-color')).toBe('var(--accent)');
    expect(token('--text-primary')).toBe('var(--ink-1)');
    expect(token('--text-secondary')).toBe('var(--ink-2)');
    expect(token('--text-tertiary')).toBe('var(--ink-3)');
    expect(token('--card-bg')).toBe('var(--surface-card)');
    expect(token('--bg-gradient')).toBe('var(--surface-ground)');
  });

  it('uses IBM Plex Sans JP as the app font', () => {
    expect(css).toContain('family=IBM+Plex+Sans+JP');
    expect(token('--font-sans')).toContain("'IBM Plex Sans JP'");
  });

  it('meets WCAG AA (4.5:1) for every ink on every surface', () => {
    for (const ink of ['--ink-1', '--ink-2', '--ink-3']) {
      for (const surface of ['--surface-ground', '--surface-card', '--surface-sunken']) {
        expect(contrastRatio(token(ink), token(surface)), `${ink} on ${surface}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('meets WCAG AA for white text on the accent', () => {
    expect(contrastRatio('#FFFFFF', token('--accent'))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio('#FFFFFF', token('--accent-press'))).toBeGreaterThanOrEqual(4.5);
  });
});

describe('AI-look removal', () => {
  it('panels are opaque (no backdrop blur)', () => {
    expect(ruleBody('.glass-panel')).not.toContain('backdrop-filter');
    expect(ruleBody('.glass-card')).not.toContain('backdrop-filter');
    expect(ruleBody('.modal-content')).not.toContain('backdrop-filter');
  });

  it('buttons are flat (no gradient, no colored shadow)', () => {
    const body = ruleBody('button');
    expect(body).not.toContain('linear-gradient');
    expect(body).toContain('box-shadow: none');
  });
});
