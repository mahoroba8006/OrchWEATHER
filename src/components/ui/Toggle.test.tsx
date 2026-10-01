import { cleanup, fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Toggle } from './Toggle';
import { renderWithMotion, setupMotionTestEnv } from './testUtils';

beforeAll(setupMotionTestEnv);
afterEach(cleanup);

describe('Toggle', () => {
  it('exposes role=switch and reflects checked in aria-checked', () => {
    renderWithMotion(<Toggle checked={true} onChange={() => {}} label="大雨" />);
    expect(screen.getByRole('switch', { name: '大雨' }).getAttribute('aria-checked')).toBe('true');
  });

  it('calls onChange with the inverted value on click', () => {
    const onChange = vi.fn();
    renderWithMotion(<Toggle checked={false} onChange={onChange} label="大雨" />);
    fireEvent.click(screen.getByRole('switch', { name: '大雨' }));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('toggles when the visible label text is clicked', () => {
    const onChange = vi.fn();
    renderWithMotion(<Toggle checked={true} onChange={onChange} label="大雨" />);
    fireEvent.click(screen.getByText('大雨'));
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('does not call onChange when disabled', () => {
    const onChange = vi.fn();
    renderWithMotion(<Toggle checked={false} onChange={onChange} label="大雨" disabled />);
    fireEvent.click(screen.getByRole('switch', { name: '大雨' }));
    fireEvent.click(screen.getByText('大雨'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('toggles with Space and Enter', async () => {
    const onChange = vi.fn();
    renderWithMotion(<Toggle checked={false} onChange={onChange} label="大雨" />);
    screen.getByRole('switch', { name: '大雨' }).focus();
    await userEvent.keyboard(' ');
    await userEvent.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('links describedBy', () => {
    renderWithMotion(<Toggle checked={false} onChange={() => {}} label="大雨" describedBy="d1" />);
    expect(screen.getByRole('switch').getAttribute('aria-describedby')).toBe('d1');
  });
});
