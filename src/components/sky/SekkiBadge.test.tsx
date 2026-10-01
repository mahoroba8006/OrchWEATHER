import { cleanup, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { renderWithMotion, setupMotionTestEnv } from '../ui/testUtils';
import { SekkiBadge } from './SekkiBadge';

beforeAll(setupMotionTestEnv);
afterEach(cleanup);

// 2026-10-01 は秋分・蟄虫坏戸
const date = new Date('2026-10-01T03:00:00Z');

describe('SekkiBadge', () => {
  it('節気・候・読みを表示する', () => {
    renderWithMotion(<SekkiBadge date={date} />);
    expect(screen.getByText('秋分')).toBeTruthy();
    expect(screen.getByText('蟄虫坏戸')).toBeTruthy();
    expect(screen.getByText('むしかくれてとをふさぐ')).toBeTruthy();
  });

  it('aria-label は節気・候・読みを含む', () => {
    renderWithMotion(<SekkiBadge date={date} />);
    expect(
      screen.getByLabelText('二十四節気 秋分、七十二候 蟄虫坏戸（むしかくれてとをふさぐ）'),
    ).toBeTruthy();
  });

  it('絵を1つ描画する（装飾）', () => {
    const { container } = renderWithMotion(<SekkiBadge date={date} />);
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBe(1);
    expect(svgs[0].getAttribute('aria-hidden')).toBe('true');
  });
});
