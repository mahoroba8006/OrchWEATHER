import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { SaveButton } from './SaveButton';
import { renderWithMotion, setupMotionTestEnv } from './testUtils';

beforeAll(setupMotionTestEnv);
afterEach(cleanup);

describe('SaveButton', () => {
  it('shows children (default 保存) and fires onClick', () => {
    const onClick = vi.fn();
    renderWithMotion(<SaveButton onClick={onClick} saving={false} saved={false} />);
    fireEvent.click(screen.getByRole('button', { name: '保存' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('shows 保存中… and is disabled while saving', () => {
    const onClick = vi.fn();
    renderWithMotion(<SaveButton onClick={onClick} saving={true} saved={false} />);
    const btn = screen.getByRole('button', { name: /保存中…/ });
    expect(btn.hasAttribute('disabled')).toBe(true);
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('shows 保存しました when saved', () => {
    renderWithMotion(<SaveButton onClick={() => {}} saving={false} saved={true} />);
    expect(screen.getByRole('button', { name: /保存しました/ })).toBeTruthy();
  });

  it('uses a custom savedLabel', () => {
    renderWithMotion(<SaveButton onClick={() => {}} saving={false} saved={true} savedLabel="基準温度を保存しました" />);
    expect(screen.getByText('基準温度を保存しました')).toBeTruthy();
  });

  it('does not fire when disabled', () => {
    const onClick = vi.fn();
    renderWithMotion(<SaveButton onClick={onClick} saving={false} saved={false} disabled>保存</SaveButton>);
    fireEvent.click(screen.getByRole('button', { name: '保存' }));
    expect(onClick).not.toHaveBeenCalled();
  });
});
