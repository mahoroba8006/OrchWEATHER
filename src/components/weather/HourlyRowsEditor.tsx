import { useEffect, useRef, useState } from 'react';
import { useAppStore, useHiddenHourlyRows } from '../../store';
import { DEFAULT_HIDDEN_HOURLY_ROWS, HOURLY_ROW_OPTIONS, type HourlyRowKey } from '../../lib/hourlyRows';
import { Button } from '../ui/Button';
import { Toggle } from '../ui/Toggle';
import '../settings/settings.css';

type SaveStatus = { kind: 'idle' | 'saving' | 'saved' | 'error'; msg?: string };

/** 時間別の表に出す項目の選択。設定画面と空もようのシートで共通 */
export function HourlyRowsEditor() {
  const hidden = useHiddenHourlyRows();
  const updateHiddenHourlyRows = useAppStore(s => s.updateHiddenHourlyRows);
  const [status, setStatus] = useState<SaveStatus>({ kind: 'idle' });
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timerRef.current), []);

  const saving = status.kind === 'saving';

  // 表示はストアの値のまま。保存に成功して初めて切り替わる
  const save = async (rows: HourlyRowKey[]) => {
    clearTimeout(timerRef.current);
    setStatus({ kind: 'saving' });
    try {
      await updateHiddenHourlyRows(rows);
      setStatus({ kind: 'saved', msg: '保存しました' });
      timerRef.current = setTimeout(() => setStatus({ kind: 'idle' }), 2500);
    } catch (err: unknown) {
      console.error('[HourlyRowsEditor] save failed', err);
      setStatus({ kind: 'error', msg: `保存失敗: ${err instanceof Error ? err.message : String(err)}` });
    }
  };

  const toggle = (key: HourlyRowKey, visible: boolean) => {
    // 並びは選択肢の順に揃える
    const next = HOURLY_ROW_OPTIONS
      .map(o => o.key)
      .filter(k => (k === key ? !visible : hidden.includes(k)));
    void save(next);
  };

  return (
    <div className="set-stack">
      <div className="set-hint">
        時間別の表に出す項目を選びます。日付・時刻・天気・気温/降水のグラフはいつも表示します。
      </div>
      <div className="set-list">
        {HOURLY_ROW_OPTIONS.map(({ key, label }) => {
          const visible = !hidden.includes(key);
          return (
            <label key={key} className={saving ? 'set-row set-row--locked' : 'set-row'}>
              <div className={visible ? 'set-row__body' : 'set-row__body set-row__body--off'}>
                <span className="set-row__title">{label}</span>
              </div>
              <span className="set-row__toggle">
                <Toggle
                  hideLabel
                  label={label}
                  checked={visible}
                  disabled={saving}
                  onChange={v => toggle(key, v)}
                />
              </span>
            </label>
          );
        })}
      </div>
      <div className="set-actions set-actions--split">
        <Button variant="secondary" className="set-btn-xs" disabled={saving} onClick={() => void save([...DEFAULT_HIDDEN_HOURLY_ROWS])}>
          おすすめに戻す
        </Button>
        <span role="status">
          {status.kind === 'error' && <span className="set-error">{status.msg}</span>}
          {status.kind === 'saved' && <span className="set-hint">{status.msg}</span>}
        </span>
      </div>
    </div>
  );
}
