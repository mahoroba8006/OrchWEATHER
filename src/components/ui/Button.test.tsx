import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Button } from './Button';
import { renderWithMotion, setupMotionTestEnv } from './testUtils';

beforeAll(setupMotionTestEnv);
afterEach(cleanup);

describe('Button', () => {
  it('renders primary variant by default and fires onClick', () => {
    const onClick = vi.fn();
    renderWithMotion(<Button onClick={onClick}>保存</Button>);
    const btn = screen.getByRole('button', { name: '保存' });
    expect(btn.className).toContain('ui-btn--primary');
    expect(btn.getAttribute('type')).toBe('button');
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('applies the requested variant and extra className', () => {
    renderWithMotion(<Button variant="ghost" className="extra">戻る</Button>);
    const btn = screen.getByRole('button', { name: '戻る' });
    expect(btn.className).toContain('ui-btn--ghost');
    expect(btn.className).toContain('extra');
  });

  it('does not fire onClick when disabled', () => {
    const onClick = vi.fn();
    renderWithMotion(<Button disabled onClick={onClick}>保存</Button>);
    fireEvent.click(screen.getByRole('button', { name: '保存' }));
    expect(onClick).not.toHaveBeenCalled();
  });
});
