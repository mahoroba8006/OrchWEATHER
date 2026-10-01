import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SEKKI } from '../../lib/sekki';
import { SEKKI_ART_COUNT, SekkiArt } from './sekkiArt';

afterEach(cleanup);

const ALLOWED = /^(#FFFFFF|#F3EBDD|none|url\(#[^)]+\))$/;
const COLOR_ATTRS = ['fill', 'stroke', 'flood-color', 'stop-color', 'lighting-color', 'color'];

describe('SekkiArt', () => {
  it('has one illustration per sekki', () => {
    expect(SEKKI_ART_COUNT).toBe(24);
    expect(SEKKI).toHaveLength(SEKKI_ART_COUNT);
  });

  it.each(Array.from({ length: 24 }, (_, i) => [i, SEKKI[i].name] as const))(
    'renders #%i (%s) as a decorative 64-unit SVG using only white / kinari',
    (i) => {
      const { container } = render(<SekkiArt index={i} />);
      const svg = container.querySelector('svg');
      expect(svg).not.toBeNull();
      expect(svg!.getAttribute('aria-hidden')).toBe('true');
      expect(svg!.getAttribute('viewBox')).toBe('0 0 64 64');
      // 何かしら描かれている（主線は 3 本以上）
      expect(svg!.querySelectorAll('path, circle, ellipse').length).toBeGreaterThanOrEqual(3);
      for (const el of svg!.querySelectorAll('*')) {
        for (const attr of COLOR_ATTRS) {
          const v = el.getAttribute(attr);
          if (v !== null) expect(v, `${el.tagName}[${attr}]`).toMatch(ALLOWED);
        }
        expect(el.getAttribute('style') ?? '').not.toMatch(/fill|stroke|color/);
      }
    },
  );

  it('applies size and className', () => {
    const { container } = render(<SekkiArt index={15} size={56} className="x" />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('width')).toBe('56');
    expect(svg.getAttribute('height')).toBe('56');
    expect(svg.getAttribute('class')).toBe('x');
  });

  it('gives each instance its own filter ids and references only its own', () => {
    const { container } = render(<><SekkiArt index={0} /><SekkiArt index={0} /></>);
    const [a, b] = container.querySelectorAll('svg');
    const ids = (s: Element) => [...s.querySelectorAll('filter')].map((f) => f.id);
    expect(ids(a).length).toBeGreaterThanOrEqual(2);
    for (const id of ids(a)) expect(ids(b)).not.toContain(id);
    for (const s of [a, b]) {
      const own = new Set(ids(s));
      for (const el of s.querySelectorAll('[filter]')) {
        const ref = el.getAttribute('filter')!.match(/^url\(#(.+)\)$/)?.[1];
        expect(own.has(ref!)).toBe(true);
      }
    }
  });

  it('wraps out-of-range indices instead of crashing', () => {
    const { container } = render(<SekkiArt index={24} />);
    expect(container.querySelector('svg')).not.toBeNull();
  });
});
