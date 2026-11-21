import { afterEach, describe, expect, it } from 'vitest';
import { lpStaticShown, rememberSignedIn, removeLpStatic, SIGNED_IN_KEY } from './lpStatic';

afterEach(() => {
  document.body.innerHTML = '';
  document.documentElement.classList.remove('skip-lp-static');
  localStorage.clear();
});

describe('lpStaticShown', () => {
  it('中身があり、隠されていなければ見えている', () => {
    document.body.innerHTML = '<div id="lp-static"><main>LP</main></div>';
    expect(lpStaticShown()).toBe(true);
  });
  it('枠が空（開発中の index.html）なら見えていない', () => {
    document.body.innerHTML = '<div id="lp-static"></div>';
    expect(lpStaticShown()).toBe(false);
  });
  it('ゲスト・ログイン済みで head のスクリプトが隠したら見えていない', () => {
    document.body.innerHTML = '<div id="lp-static"><main>LP</main></div>';
    document.documentElement.classList.add('skip-lp-static');
    expect(lpStaticShown()).toBe(false);
  });
  it('消した後は見えていない（何度消してもよい）', () => {
    document.body.innerHTML = '<div id="lp-static"><main>LP</main></div>';
    removeLpStatic();
    removeLpStatic();
    expect(document.getElementById('lp-static')).toBeNull();
    expect(lpStaticShown()).toBe(false);
  });
});

describe('rememberSignedIn', () => {
  it('ログインで目印を付け、ログアウトで外す（index.html の head と同じ名前）', () => {
    rememberSignedIn(true);
    expect(localStorage.getItem(SIGNED_IN_KEY)).toBe('1');
    expect(SIGNED_IN_KEY).toBe('orch.signedIn');
    rememberSignedIn(false);
    expect(localStorage.getItem(SIGNED_IN_KEY)).toBeNull();
  });
});
