import { useState, useEffect } from 'react';
import type { CSSProperties } from 'react';
import { Save, RotateCcw } from 'lucide-react';
import { useAppStore, ALL_JMA_GROUPS, type JmaWarningGroup } from '../../store';

type SaveStatus = { kind: 'idle' | 'saving' | 'saved' | 'error'; msg?: string };

const SAVE_BTN: CSSProperties = {
  background: 'rgba(13,148,136,0.15)',
  color: 'var(--accent-color)',
  border: '1px solid rgba(13,148,136,0.35)',
  borderRadius: 'var(--radius-md, 6px)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '0.3rem',
  padding: '0.4rem 0.9rem',
  fontSize: '0.85rem',
};

const GROUP_SECTIONS: { label: string; groups: JmaWarningGroup[] }[] = [
  {
    label: '降水・風',
    groups: ['大雨', '洪水', '大雪', '強風', '風雪', '波浪', '高潮'],
  },
  {
    label: '農業・その他',
    groups: ['乾燥', '霜', '低温', '雷', '濃霧', 'なだれ', '融雪', '着氷', '着雪'],
  },
];

export function JmaWarningSettings() {
  const { userSettings, updateEnabledJmaGroups } = useAppStore();
  const [enabled, setEnabled] = useState<JmaWarningGroup[]>(
    userSettings?.enabledJmaGroups ?? ALL_JMA_GROUPS
  );
  const [status, setStatus] = useState<SaveStatus>({ kind: 'idle' });

  useEffect(() => {
    if (userSettings?.enabledJmaGroups) {
      setEnabled(userSettings.enabledJmaGroups);
    }
  }, [userSettings]);

  const toggle = (group: JmaWarningGroup, checked: boolean) => {
    setEnabled(prev =>
      checked
        ? prev.includes(group) ? prev : [...prev, group]
        : prev.filter(g => g !== group)
    );
  };

  const handleSave = async (groups: JmaWarningGroup[]) => {
    setStatus({ kind: 'saving' });
    try {
      await updateEnabledJmaGroups(groups);
      setStatus({ kind: 'saved', msg: '保存しました' });
      setTimeout(() => setStatus({ kind: 'idle' }), 2500);
    } catch (err: unknown) {
      setStatus({
        kind: 'error',
        msg: `保存失敗: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  };

  const handleReset = async () => {
    setEnabled(ALL_JMA_GROUPS);
    await handleSave(ALL_JMA_GROUPS);
  };

  const renderStatus = () => {
    if (status.kind === 'idle') return null;
    const color =
      status.kind === 'error' ? '#c62828' :
      status.kind === 'saved' ? '#2e7d32' :
      'var(--text-secondary)';
    return (
      <span style={{ marginRight: '0.6rem', fontSize: '0.78rem', color, alignSelf: 'center' }}>
        {status.kind === 'saving' ? '保存中…' : status.msg}
      </span>
    );
  };

  return (
    <div
      className="glass-panel"
      style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}
    >
      <div>
        <h3 style={{ margin: '0 0 0.35rem', fontSize: '1rem' }}>注意報・警報の表示設定</h3>
        <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
          チェックを外した種別は天気情報タブに表示されません。特別警報は常に表示されます。
        </p>
      </div>

      {GROUP_SECTIONS.map(section => (
        <div key={section.label}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>
            {section.label}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {section.groups.map(group => (
              <label
                key={group}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.3rem 0.65rem',
                  borderRadius: '999px',
                  border: `1px solid ${enabled.includes(group) ? 'rgba(13,148,136,0.4)' : 'var(--card-border)'}`,
                  background: enabled.includes(group) ? 'rgba(13,148,136,0.08)' : 'transparent',
                  cursor: 'pointer',
                  fontSize: '0.82rem',
                  fontWeight: enabled.includes(group) ? 600 : 400,
                  color: enabled.includes(group) ? 'var(--accent-color)' : 'var(--text-secondary)',
                  userSelect: 'none',
                  transition: 'all 0.15s',
                }}
              >
                <input
                  type="checkbox"
                  checked={enabled.includes(group)}
                  onChange={e => toggle(group, e.target.checked)}
                  style={{ width: '0.9rem', height: '0.9rem', cursor: 'pointer', flexShrink: 0, accentColor: 'var(--accent-color)' }}
                />
                {group}
              </label>
            ))}
          </div>
        </div>
      ))}

      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        paddingTop: '0.5rem', borderTop: '1px solid rgba(0,0,0,0.06)',
      }}>
        <button
          onClick={handleReset}
          disabled={status.kind === 'saving'}
          className="secondary"
          style={{
            display: 'flex', alignItems: 'center', gap: '0.3rem',
            fontSize: '0.82rem', padding: '0.4rem 0.75rem',
            opacity: status.kind === 'saving' ? 0.6 : 1,
            cursor: status.kind === 'saving' ? 'not-allowed' : 'pointer',
          }}
        >
          <RotateCcw size={13} /> すべて表示に戻す
        </button>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {renderStatus()}
          <button
            onClick={() => handleSave(enabled)}
            disabled={status.kind === 'saving'}
            style={{
              ...SAVE_BTN,
              cursor: status.kind === 'saving' ? 'not-allowed' : 'pointer',
              opacity: status.kind === 'saving' ? 0.6 : 1,
            }}
          >
            <Save size={14} /> 保存
          </button>
        </div>
      </div>
    </div>
  );
}
