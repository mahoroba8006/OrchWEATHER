import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
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

  it('絵は描画しない（文字のみ。絵はヒーロー背景）', () => {
    const { container } = renderWithMotion(<SekkiBadge date={date} />);
    expect(container.querySelector('svg')).toBeNull();
  });

  it('onOpen があれば、直前の節気のふりかえりを開くボタンになる', () => {
    const onOpen = vi.fn();
    renderWithMotion(<SekkiBadge date={date} onOpen={onOpen} />);
    const btn = screen.getByRole('button', { name: /白露のふりかえりを開く/ });
    fireEvent.click(btn);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('onOpen が無ければボタンにしない', () => {
    renderWithMotion(<SekkiBadge date={date} />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
