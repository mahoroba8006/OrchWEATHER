import { cleanup, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { useAppStore } from '../../store';
import { renderWithMotion, setupMotionTestEnv } from '../ui/testUtils';
import { SeasonReviewBaseSettings } from './SeasonReviewBaseSettings';

beforeAll(setupMotionTestEnv);
afterEach(cleanup);

describe('SeasonReviewBaseSettings', () => {
  it('見出しは「節気の比較」、選択肢は左から 去年・5年平均、未設定は去年', () => {
    useAppStore.setState({ userSettings: null } as never);
    renderWithMotion(<SeasonReviewBaseSettings />);
    expect(screen.getByRole('heading', { name: '節気の比較' })).toBeTruthy();
    expect(screen.getByText('節気のふりかえりカードの一言を、どちらと比べて書くかを選びます。')).toBeTruthy();
    const tabs = Array.from(screen.getByRole('tablist', { name: '節気の比較' }).querySelectorAll('[role="tab"]'));
    expect(tabs.map(t => t.textContent)).toEqual(['去年', '5年平均']);
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
  });
});
