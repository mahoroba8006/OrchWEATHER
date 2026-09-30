import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { SegmentedControl } from './SegmentedControl';
import { renderWithMotion, setupMotionTestEnv } from './testUtils';

beforeAll(setupMotionTestEnv);
afterEach(cleanup);

const options = [
  { value: 'daily', label: '日' },
  { value: 'monthly', label: '月' },
] as const;

describe('SegmentedControl', () => {
  it('exposes a tablist with the selected tab marked', () => {
    renderWithMotion(
      <SegmentedControl ariaLabel="表示単位" layoutId="unit" options={options} value="daily" onChange={() => {}} />,
    );
    expect(screen.getByRole('tablist', { name: '表示単位' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: '日' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: '月' }).getAttribute('aria-selected')).toBe('false');
  });

  it('calls onChange with the clicked value, but not for the current one', () => {
    const onChange = vi.fn();
    renderWithMotion(
      <SegmentedControl ariaLabel="表示単位" layoutId="unit" options={options} value="daily" onChange={onChange} />,
    );
    fireEvent.click(screen.getByRole('tab', { name: '日' }));
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('tab', { name: '月' }));
    expect(onChange).toHaveBeenCalledWith('monthly');
  });

  it('renders exactly one sliding thumb', () => {
    const { container } = renderWithMotion(
      <SegmentedControl ariaLabel="表示単位" layoutId="unit" options={options} value="monthly" onChange={() => {}} />,
    );
    expect(container.querySelectorAll('.ui-seg__thumb')).toHaveLength(1);
  });

  it('supports the underline variant', () => {
    renderWithMotion(
      <SegmentedControl ariaLabel="設定" layoutId="sub" variant="underline" options={options} value="daily" onChange={() => {}} />,
    );
    expect(screen.getByRole('tablist').className).toContain('ui-seg--underline');
  });

  it('moves selection with arrow keys', () => {
    const onChange = vi.fn();
    renderWithMotion(
      <SegmentedControl ariaLabel="表示単位" layoutId="unit" options={options} value="daily" onChange={onChange} />,
    );
    fireEvent.keyDown(screen.getByRole('tab', { name: '日' }), { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('monthly');
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: '月' }));
  });

  it('sets tab ids from idPrefix', () => {
    renderWithMotion(
      <SegmentedControl ariaLabel="表示単位" layoutId="unit" idPrefix="u" options={options} value="daily" onChange={() => {}} />,
    );
    expect(screen.getByRole('tab', { name: '日' }).id).toBe('u-daily');
    expect(screen.getByRole('tab', { name: '月' }).id).toBe('u-monthly');
  });
});
