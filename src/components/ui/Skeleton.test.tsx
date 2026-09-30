import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Skeleton } from './Skeleton';

afterEach(cleanup);

describe('Skeleton', () => {
  it('reflects width and height and is aria-hidden', () => {
    const { container } = render(<Skeleton width={120} height="44px" radius="8px" className="x" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain('ui-skeleton');
    expect(el.className).toContain('x');
    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect(el.style.width).toBe('120px');
    expect(el.style.height).toBe('44px');
    expect(el.style.borderRadius).toBe('8px');
  });
});
