import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';

afterEach(cleanup);

let shouldThrow = true;
function Bomb() {
  if (shouldThrow) throw new Error('boom');
  return <p>復帰しました</p>;
}

describe('ErrorBoundary', () => {
  it('子が投げたら fallback を表示し、reset で子を再描画する', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    shouldThrow = true;
    const onError = vi.fn();
    render(
      <ErrorBoundary onError={onError} fallback={reset => <button onClick={reset}>再試行</button>}>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.getByText('再試行')).toBeTruthy();
    expect(onError).toHaveBeenCalledTimes(1);
    shouldThrow = false;
    fireEvent.click(screen.getByText('再試行'));
    expect(screen.getByText('復帰しました')).toBeTruthy();
  });
});

describe('ErrorBoundary（エラー内容を fallback へ）', () => {
  it('fallback に投げられたエラーを渡す（原因を画面に出せるように）', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    shouldThrow = true;
    render(
      <ErrorBoundary fallback={(_reset, error) => <p>{`エラー: ${error?.message}`}</p>}>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.getByText('エラー: boom')).toBeTruthy();
  });
});
