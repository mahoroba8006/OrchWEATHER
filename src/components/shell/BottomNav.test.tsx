import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { renderWithMotion, setupMotionTestEnv } from '../ui/testUtils';
import { BottomNav } from './BottomNav';

beforeAll(setupMotionTestEnv);
afterEach(cleanup);

describe('BottomNav', () => {
  it('選択中のタブが aria-current になる', () => {
    renderWithMotion(<BottomNav tab="analysis" onTabChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: '空くらべ' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('button', { name: '空もよう' }).getAttribute('aria-current')).toBeNull();
  });

  it('他のタブをクリックすると onTabChange が呼ばれる', () => {
    const onTabChange = vi.fn();
    renderWithMotion(<BottomNav tab="weather" onTabChange={onTabChange} />);
    fireEvent.click(screen.getByRole('button', { name: '空しらべ' }));
    expect(onTabChange).toHaveBeenCalledWith('history');
  });
});
