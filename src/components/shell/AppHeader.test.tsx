import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithMotion, setupMotionTestEnv } from '../ui/testUtils';
import { useSkyStore } from '../../skyStore';
import { AppHeader, type AppHeaderProps } from './AppHeader';

beforeAll(setupMotionTestEnv);
afterEach(cleanup);
beforeEach(() => {
  useSkyStore.setState({ sky: null, summary: null, heroVisible: true });
});

function setup(over: Partial<AppHeaderProps> = {}) {
  const props: AppHeaderProps = {
    tab: 'weather',
    onTabChange: vi.fn(),
    isMobile: false,
    user: null,
    onLogin: vi.fn(),
    onLogout: vi.fn(),
    onOpenHelp: vi.fn(),
    onOpenSettings: vi.fn(),
    ...over,
  };
  renderWithMotion(<AppHeader {...props} />);
  return props;
}

const summary = { temperature: 21.6, weatherCode: 0, locationName: 'テスト圃場' };

describe('AppHeader', () => {
  it('PC: 選択中タブが aria-selected で、他タブのクリックで onTabChange', () => {
    const props = setup({ tab: 'analysis' });
    expect(screen.getByRole('tab', { name: '空くらべ' }).getAttribute('aria-selected')).toBe('true');
    fireEvent.click(screen.getByRole('tab', { name: '空もよう' }));
    expect(props.onTabChange).toHaveBeenCalledWith('weather');
  });

  it('モバイル: ヘッダーにはタブを出さない', () => {
    setup({ isMobile: true });
    expect(screen.queryByRole('tab')).toBeNull();
  });

  it('設定・使い方ボタンでコールバックが呼ばれる', () => {
    const props = setup();
    fireEvent.click(screen.getByRole('button', { name: '設定' }));
    fireEvent.click(screen.getByRole('button', { name: '使い方' }));
    expect(props.onOpenSettings).toHaveBeenCalledTimes(1);
    expect(props.onOpenHelp).toHaveBeenCalledTimes(1);
  });

  it('未ログインでは「ログイン」ボタンが onLogin を呼ぶ', () => {
    const props = setup();
    fireEvent.click(screen.getByRole('button', { name: 'ログイン' }));
    expect(props.onLogin).toHaveBeenCalledTimes(1);
  });

  it('ログイン時: PCはログアウトボタン、モバイルは出さない', () => {
    const user = { photoURL: null, displayName: 'テスト' };
    const props = setup({ user });
    fireEvent.click(screen.getByRole('button', { name: 'ログアウト' }));
    expect(props.onLogout).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'ログイン' })).toBeNull();
    cleanup();
    setup({ user, isMobile: true });
    expect(screen.queryByRole('button', { name: 'ログアウト' })).toBeNull();
  });

  it('ヒーローが隠れた空もようでは気温要約を出す', () => {
    setup();
    expect(screen.queryByText(/テスト圃場/)).toBeNull();
    act(() => useSkyStore.setState({ summary, heroVisible: false }));
    expect(screen.getByText('テスト圃場 22° 快晴')).toBeTruthy();
  });

  it('ヒーローが見えている間、および空もよう以外では気温要約を出さない', () => {
    useSkyStore.setState({ summary, heroVisible: true });
    setup();
    expect(screen.queryByText(/テスト圃場/)).toBeNull();
    cleanup();
    useSkyStore.setState({ heroVisible: false });
    setup({ tab: 'analysis' });
    expect(screen.queryByText(/テスト圃場/)).toBeNull();
  });
});
