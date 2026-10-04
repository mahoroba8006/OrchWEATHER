import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppErrorFallback } from './AppErrorFallback';

afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); });

describe('AppErrorFallback', () => {
  it('真っ白にせず、エラー内容と再読み込みの手段を出す', () => {
    render(<AppErrorFallback error={new TypeError('x is not a function')} />);
    expect(screen.getByText(/表示中に問題が起きました/)).toBeTruthy();
    expect(screen.getByText('TypeError: x is not a function')).toBeTruthy();
    expect(screen.getByRole('button', { name: '再読み込み' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '端末の保存データを消して再読み込み' })).toBeTruthy();
  });

  it('保存データの消去は、端末保存した実績と表示設定だけを消し、ゲスト状態は残す', async () => {
    localStorage.setItem('pastActuals:v1:35.68,139.77', '{}');
    localStorage.setItem('hiddenHourlyRows', '[]');
    localStorage.setItem('guestMode', '1');
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });
    render(<AppErrorFallback error={new Error('e')} />);
    fireEvent.click(screen.getByRole('button', { name: '端末の保存データを消して再読み込み' }));
    await vi.waitFor(() => expect(reload).toHaveBeenCalled());
    expect(localStorage.getItem('pastActuals:v1:35.68,139.77')).toBeNull();
    expect(localStorage.getItem('hiddenHourlyRows')).toBeNull();
    expect(localStorage.getItem('guestMode')).toBe('1');
  });
});
