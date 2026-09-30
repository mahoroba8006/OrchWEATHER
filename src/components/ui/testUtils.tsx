import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { MotionGlobalConfig } from 'motion/react';
import { vi } from 'vitest';
import { MotionProvider } from './MotionProvider';

/** jsdom ではアニメーションを即時完了させ、matchMedia を用意する */
export function setupMotionTestEnv(): void {
  MotionGlobalConfig.skipAnimations = true;
  if (typeof window.matchMedia !== 'function') {
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }) as unknown as typeof window.matchMedia;
  }
}

export function renderWithMotion(ui: ReactElement) {
  return render(<MotionProvider>{ui}</MotionProvider>);
}
