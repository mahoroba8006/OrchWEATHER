// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { CountUp } from './primitives';

describe('CountUp（ビルド時の描画）', () => {
  it('window が無いときは 0 ではなく最終の値で書き出す', () => {
    const html = renderToString(<CountUp to={18} />);
    expect(html).toContain('<span aria-hidden="true">18</span>');
  });
});
