import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');

describe('settings theme palette', () => {
  it('uses an indigo utility palette instead of the amber warning palette', () => {
    expect(css).toContain('--settings-bg-gradient: linear-gradient(135deg, #f7f8fc 0%, #eef2ff 100%);');
    expect(css).toContain('--settings-accent: #4f46e5;');
    expect(css).toContain('--settings-accent-hover: #4338ca;');
    expect(css).toContain('--settings-accent-light: rgba(79, 70, 229, 0.10);');
    expect(css).toContain('--settings-accent-text: #4338ca;');
  });

  it('propagates the indigo palette to settings borders and shadows', () => {
    expect(css).toContain('--card-border: rgba(79, 70, 229, 0.22);');
    expect(css).toContain('--card-border-hover: rgba(67, 56, 202, 0.40);');
    expect(css).toContain('--grid-color: rgba(79, 70, 229, 0.12);');
    expect(css).toContain('--settings-shadow-md: 0 8px 24px rgba(67, 56, 202, 0.07), 0 4px 12px rgba(79, 70, 229, 0.04);');
  });
});
