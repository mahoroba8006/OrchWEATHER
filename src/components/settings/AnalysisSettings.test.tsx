import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '../../store';
import { renderWithMotion, setupMotionTestEnv } from '../ui/testUtils';
import { AnalysisSettings } from './AnalysisSettings';

beforeAll(setupMotionTestEnv);
afterEach(cleanup);

const setup = (update: ReturnType<typeof vi.fn>, uppers: [number | null, number | null] = [null, null]) => {
  useAppStore.setState({
    userSettings: {
      baseTempSettings: [10, 3.5], gddUpperTemps: uppers,
      accumStartDates: { precip: '01-01', sunshine: '01-01', radiation: '01-01', gdd: '01-01' },
      accumDeltaThresholds: { gdd: 30, radiation: 100 },
    },
    updateGddSettings: update,
  } as never);
  renderWithMotion(<AnalysisSettings />);
};
const upperInput = (n: number) => screen.getAllByPlaceholderText('なし')[n - 1];
const save = () => fireEvent.click(screen.getAllByRole('button', { name: /保存/ })[0]);

describe('AnalysisSettings 上限温度', () => {
  it('空欄は上限なしとして基準温度と一緒に保存する', async () => {
    const update = vi.fn(async () => {});
    setup(update);
    save();
    await waitFor(() => expect(update).toHaveBeenCalledWith([10, 3.5], [null, null]));
  });

  it('入力した上限を組ごとに保存する', async () => {
    const update = vi.fn(async () => {});
    setup(update);
    fireEvent.change(upperInput(1), { target: { value: '33' } });
    save();
    await waitFor(() => expect(update).toHaveBeenCalledWith([10, 3.5], [33, null]));
  });

  it('範囲外・基準温度以下はエラーを出して保存しない', async () => {
    const update = vi.fn(async () => {});
    setup(update);
    fireEvent.change(upperInput(1), { target: { value: '55' } });
    save();
    await waitFor(() => expect(screen.getByText('上限温度1は20〜50℃で入力してください')).toBeTruthy());
    fireEvent.change(upperInput(1), { target: { value: '' } });
    fireEvent.change(upperInput(2), { target: { value: '20' } });
    fireEvent.change(screen.getAllByRole('spinbutton')[2], { target: { value: '25' } });
    save();
    await waitFor(() => expect(screen.getByText('上限温度2は基準温度2より高くしてください')).toBeTruthy());
    expect(update).not.toHaveBeenCalled();
  });
});
