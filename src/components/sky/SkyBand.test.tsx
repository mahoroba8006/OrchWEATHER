import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fallbackSky, useSkyStore } from '../../skyStore';
import { SkyBand } from './SkyBand';

afterEach(cleanup);
beforeEach(() => useSkyStore.setState({ sky: null, summary: null, heroVisible: true }));

describe('SkyBand', () => {
  it('タイトルを見出しとして出す', () => {
    render(<SkyBand title="空くらべ" />);
    expect(screen.getByRole('heading', { level: 1, name: '空くらべ' })).toBeTruthy();
  });

  it('ストアの空の色を背景に使う', () => {
    const sky = { ...fallbackSky(), top: '#123456', bottom: '#654321' };
    useSkyStore.setState({ sky });
    const { container } = render(<SkyBand title="空しらべ" />);
    const bg = (container.firstElementChild as HTMLElement).style.background;
    expect(bg).toContain('linear-gradient');
    expect(bg.toLowerCase()).toMatch(/#123456|rgb\(18, 52, 86\)/);
  });
});
