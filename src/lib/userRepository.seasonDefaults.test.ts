import { describe, expect, it, vi } from 'vitest';

const getDocMock = vi.fn();
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => 'ref'), getDoc: (...a: unknown[]) => getDocMock(...a), setDoc: vi.fn(), serverTimestamp: vi.fn(),
}));
vi.mock('./firebase', () => ({ db: {}, auth: {} }));

import { getUserSettings } from './userRepository';

const withData = (data: Record<string, unknown> | undefined) => getDocMock.mockResolvedValue({ data: () => data });

describe('節気の比較・季節のあしどりの既定', () => {
  it('未設定なら 去年と比べる／降水量・日照時間は直近30日、積算温度は累積', async () => {
    withData(undefined);
    const s = await getUserSettings('u1');
    expect(s.seasonReviewBase).toBe('lastYear');
    expect(s.seasonPaceModes).toEqual({ precip: 'recent', gdd: 'analysis', sunshine: 'recent' });
  });

  it('保存済みの選択はそのまま（5年平均・項目ごとの比べ方・旧形式の共通設定）', async () => {
    withData({ seasonReviewBase: 'avg', seasonPaceModes: { precip: 'analysis', gdd: 'recent', sunshine: 'analysis' } });
    const s = await getUserSettings('u1');
    expect(s.seasonReviewBase).toBe('avg');
    expect(s.seasonPaceModes).toEqual({ precip: 'analysis', gdd: 'recent', sunshine: 'analysis' });
    withData({ seasonPaceMode: 'analysis' });
    expect((await getUserSettings('u1')).seasonPaceModes).toEqual({ precip: 'analysis', gdd: 'analysis', sunshine: 'analysis' });
  });
});
