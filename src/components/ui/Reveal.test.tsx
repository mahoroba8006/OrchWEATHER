import { cleanup, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Reveal } from './Reveal';
import { renderWithMotion, setupMotionTestEnv } from './testUtils';
import { markIntroPlayed, resetIntroForTest } from '../../lib/intro';

beforeAll(setupMotionTestEnv);
beforeEach(resetIntroForTest);
afterEach(cleanup);

describe('Reveal', () => {
  it('animates when the intro has not played yet', () => {
    renderWithMotion(<Reveal index={0}><p>中身</p></Reveal>);
    const child = screen.getByText('中身');
    expect(child).toBeTruthy();
    expect(child.parentElement?.getAttribute('data-reveal')).toBe('animate');
  });

  it('renders statically after the intro has played', () => {
    markIntroPlayed();
    renderWithMotion(<Reveal index={2}><p>中身</p></Reveal>);
    const child = screen.getByText('中身');
    expect(child.parentElement?.getAttribute('data-reveal')).toBe('static');
  });
});
