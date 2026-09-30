import { cleanup, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { JmaWarningSummary } from './JmaWarningSummary';
import { renderWithMotion, setupMotionTestEnv } from '../ui/testUtils';
import type { JmaWarningResult } from '../../api/jmaWarning';

beforeAll(setupMotionTestEnv);
afterEach(cleanup);

const result = (items: JmaWarningResult['items']): JmaWarningResult => ({
  reportDatetime: '2026-10-01T03:00:00Z',
  areaCode: '130010',
  items,
});

describe('JmaWarningSummary', () => {
  it('renders warning and advisory rows with levels', () => {
    const { container } = renderWithMotion(
      <JmaWarningSummary
        loading={false}
        result={result([
          { code: '15', name: '大雨', level: 'advisory', status: '継続' },
          { code: '03', name: '暴風', level: 'warning', status: '発表', validPeriod: '10/1 12:00〜' },
        ])}
      />,
    );
    expect(screen.getByText('大雨')).toBeTruthy();
    expect(screen.getByText('暴風')).toBeTruthy();
    const rows = container.querySelectorAll('[data-level]');
    expect(rows).toHaveLength(2);
    // 警報が注意報より先
    expect(rows[0].getAttribute('data-level')).toBe('warning');
    expect(rows[1].getAttribute('data-level')).toBe('advisory');
  });

  it('renders nothing when there are no items', () => {
    const { container } = renderWithMotion(<JmaWarningSummary loading={false} result={result([])} />);
    expect(container.querySelector('[data-level]')).toBeNull();
    expect(container.textContent).toBe('');
  });
});
