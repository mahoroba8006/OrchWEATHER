import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '../../store';
import { DEFAULT_PACE_OPTIONS } from '../../lib/seasonReview';
import { renderWithMotion, setupMotionTestEnv } from '../ui/testUtils';
import { SeasonPaceSettings } from './SeasonPaceSettings';

beforeAll(setupMotionTestEnv);
afterEach(cleanup);

describe('SeasonPaceSettings', () => {
  it('項目ごとの切り替えで、その項目だけ変えた比べ方を保存する', async () => {
    const update = vi.fn(async () => {});
    useAppStore.setState({ userSettings: { seasonPaceModes: DEFAULT_PACE_OPTIONS.modes }, updateSeasonPaceModes: update } as never);
    renderWithMotion(<SeasonPaceSettings />);
    const group = screen.getByRole('tablist', { name: '季節のあしどり 積算温度の比べ方' });
    fireEvent.click(group.querySelectorAll('[role="tab"]')[1]);
    expect(update).toHaveBeenCalledWith({ ...DEFAULT_PACE_OPTIONS.modes, gdd: 'recent' });
    await waitFor(() => expect(screen.getByText('比べ方を保存しました')).toBeTruthy());
  });

  it('保存に失敗したら知らせる', async () => {
    useAppStore.setState({ userSettings: { seasonPaceModes: DEFAULT_PACE_OPTIONS.modes }, updateSeasonPaceModes: vi.fn(async () => { throw new Error('offline'); }) } as never);
    renderWithMotion(<SeasonPaceSettings />);
    const group = screen.getByRole('tablist', { name: '季節のあしどり 降水量の比べ方' });
    fireEvent.click(group.querySelectorAll('[role="tab"]')[1]);
    await waitFor(() => expect(screen.getByText('保存失敗: offline')).toBeTruthy());
  });
});
