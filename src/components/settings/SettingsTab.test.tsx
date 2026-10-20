import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(), getDoc: vi.fn(), setDoc: vi.fn(), updateDoc: vi.fn(), deleteDoc: vi.fn(),
  collection: vi.fn(), getDocs: vi.fn(), onSnapshot: vi.fn(), serverTimestamp: vi.fn(),
}));
vi.mock('firebase/auth', () => ({ signOut: vi.fn() }));
vi.mock('../../lib/firebase', () => ({ db: {}, auth: {} }));

import { SettingsTab } from './SettingsTab';

describe('SettingsTab', () => {
  it('空のアドバイスの停止中は、そのタブを出さない', () => {
    render(<SettingsTab />);
    expect(screen.getByText('地点設定')).toBeTruthy();
    expect(screen.getByText('空くらべ')).toBeTruthy();
    expect(screen.queryByText('空のアドバイス')).toBeNull();
  });
});
