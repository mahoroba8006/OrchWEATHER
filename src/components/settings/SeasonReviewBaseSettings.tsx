import { useState } from 'react';
import { useAppStore } from '../../store';
import { SegmentedControl } from '../ui/SegmentedControl';
import { DEFAULT_PACE_OPTIONS, type ReviewBase } from '../../lib/seasonReview';
import './settings.css';

type SaveStatus = { kind: 'idle' | 'saving' | 'saved' | 'error'; msg?: string };

/** 節気ふりかえりカードの一言（見出し）を、去年と5年平均のどちらと比べて作るか */
export function SeasonReviewBaseSettings() {
  const { userSettings, updateSeasonReviewBase } = useAppStore();
  const [status, setStatus] = useState<SaveStatus>({ kind: 'idle' });
  const base = userSettings?.seasonReviewBase ?? DEFAULT_PACE_OPTIONS.reviewBase;

  // 選択はストアの値をそのまま表示するので、保存に失敗しても元の選択のまま残る
  const handleChange = async (next: ReviewBase) => {
    setStatus({ kind: 'saving' });
    try {
      await updateSeasonReviewBase(next);
      setStatus({ kind: 'saved', msg: '比べる相手を保存しました' });
      setTimeout(() => setStatus({ kind: 'idle' }), 2500);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[SeasonReviewBaseSettings] season review base save failed', err);
      setStatus({ kind: 'error', msg: `保存失敗: ${message}` });
    }
  };

  return (
    <div className="set-card">
      <h3 className="set-title">ふりかえりの一言の比べる相手</h3>
      <div className="set-hint">
        節気のふりかえりカードの一言（「雨が少なく、日差しが多い」など）を、どちらと比べて書くかを選びます。
        表の去年比・5年平均比は、どちらを選んでも両方表示します。
      </div>
      <SegmentedControl<ReviewBase>
        options={[
          { value: 'avg', label: '5年平均' },
          { value: 'lastYear', label: '去年' },
        ]}
        value={base}
        onChange={handleChange}
        ariaLabel="ふりかえりの一言の比べる相手"
        layoutId="settings-season-review-base"
      />
      <div className="set-actions">
        {status.kind === 'error' && <span className="set-error">{status.msg}</span>}
        {status.kind === 'saved' && <span className="set-hint">{status.msg}</span>}
      </div>
    </div>
  );
}
