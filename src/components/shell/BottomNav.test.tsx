import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { renderWithMotion, setupMotionTestEnv } from '../ui/testUtils';
import { SKY_WEATHERS, TIMES_OF_DAY, skyPalette } from '../../lib/sky';
import { contrastRatio } from '../../lib/contrast';
import { BottomNav, bottomNavColors } from './BottomNav';

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

  it('選択印の文字色は全36通りの空で淡い背景に対し 4.5:1 以上', () => {
    for (const tod of TIMES_OF_DAY) for (const w of SKY_WEATHERS) {
      const { soft, text } = bottomNavColors(skyPalette(tod, w).top);
      expect(contrastRatio(text, soft), `${tod}/${w}`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(text, '#ffffff'), `${tod}/${w} on white`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('空の色を CSS 変数として nav に渡す', () => {
    renderWithMotion(<BottomNav tab="weather" onTabChange={vi.fn()} />);
    const nav = screen.getByRole('navigation', { name: '画面' });
    expect(nav.style.getPropertyValue('--nav-sky-soft')).toMatch(/^#[0-9a-f]{6}$/i);
    expect(nav.style.getPropertyValue('--nav-sky-text')).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
