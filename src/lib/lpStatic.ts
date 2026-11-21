// ビルド時に index.html へ入れた LP（#lp-static・build/lpPrerender.ts）の扱い。
// 初めての人にはこれが最初に見え、React が本物の LP かアプリの画面を出した時点で消す。
// ゲスト・ログイン済みの人には index.html の head のスクリプトが最初から隠す（目印の名前はそこと同じ）。

const SLOT_ID = 'lp-static';
/** ログイン済みの目印（ログイン状態は非同期にしか分からないので、次に開いたとき LP を隠すために残す） */
export const SIGNED_IN_KEY = 'orch.signedIn';

function slot(doc: Document): HTMLElement | null {
  return doc.getElementById(SLOT_ID);
}

/** ビルド時の LP が画面に出ているか（中身があり、head のスクリプトで隠されていない） */
export function lpStaticShown(doc: Document = document): boolean {
  const el = slot(doc);
  return !!el && el.childElementCount > 0 && !doc.documentElement.classList.contains('skip-lp-static');
}

/** ビルド時の LP を消す（何度呼んでもよい） */
export function removeLpStatic(doc: Document = document): void {
  slot(doc)?.remove();
}

/** ログイン済みの目印を付け外しする（ログアウトしたら外し、次は LP を見せる） */
export function rememberSignedIn(signedIn: boolean): void {
  try {
    if (signedIn) localStorage.setItem(SIGNED_IN_KEY, '1');
    else localStorage.removeItem(SIGNED_IN_KEY);
  } catch {
    // localStorage が使えない環境では目印なし（LP が一瞬映るだけで動作に支障はない）
  }
}
