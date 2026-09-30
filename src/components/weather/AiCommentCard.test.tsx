import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { AiCommentCard } from './AiCommentCard';
import { renderWithMotion, setupMotionTestEnv } from '../ui/testUtils';
import type { AiCommentData } from '../../api/aiComment';
import type { AiSection } from '../../store';

beforeAll(setupMotionTestEnv);
afterEach(cleanup);

const comment: AiCommentData = {
  weatherOverview: '概況の本文です',
  sprayingAdvice: '散布の本文です',
  fertilizingAdvice: '施肥の本文です',
  generalWorkAdvice: '畑しごとの本文です',
};
const sections: AiSection[] = ['weatherOverview', 'generalWorkAdvice', 'sprayingAdvice'];

function renderCard(overrides: Partial<React.ComponentProps<typeof AiCommentCard>> = {}) {
  return renderWithMotion(
    <AiCommentCard
      comment={comment}
      loading={false}
      enabledSections={sections}
      customText={null}
      customLoading={false}
      hasCustomPrompt={false}
      {...overrides}
    />,
  );
}

describe('AiCommentCard', () => {
  it('タブが role=tab で並び、選択中が aria-selected=true', () => {
    renderCard();
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(3);
    expect(screen.getByRole('tab', { name: '空ごよみ' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: '畑しごと' }).getAttribute('aria-selected')).toBe('false');
    expect(screen.getByText('概況の本文です')).toBeTruthy();
  });

  it('別のタブをクリックすると表示セクションが切り替わる', async () => {
    renderCard();
    fireEvent.click(screen.getByRole('tab', { name: '散布どき' }));
    expect(await screen.findByText('散布の本文です')).toBeTruthy();
    expect(screen.getByRole('tab', { name: '散布どき' }).getAttribute('aria-selected')).toBe('true');
  });

  it('生成中はローディング文言が表示される', () => {
    renderCard({ comment: null, loading: true });
    expect(screen.getByText(/お天気を分析中/)).toBeTruthy();
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
  });

  it('選択中のタブに紐づく tabpanel が1つだけある', () => {
    renderCard();
    const panel = screen.getByRole('tabpanel');
    expect(panel.getAttribute('aria-labelledby')).toBe('ai-tab-weatherOverview');
    expect(document.getElementById('ai-tab-weatherOverview')?.getAttribute('role')).toBe('tab');
  });
});
