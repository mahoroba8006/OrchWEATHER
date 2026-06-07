import { useState, useEffect } from 'react';
import type { CSSProperties } from 'react';
import { Save } from 'lucide-react';
import { useAppStore, DEFAULT_AI_SECTIONS, type AiSection } from '../../store';

type SaveStatus = { kind: 'idle' | 'saving' | 'saved' | 'error'; msg?: string };

const MAX_CUSTOM_PROMPT = 200;

interface SectionMeta { label: string; desc: string }

const SECTION_INFO: Record<AiSection, SectionMeta> = {
  weatherOverview:   { label: '空ごよみ',   desc: '今日・明日の天気概況と数日先の傾向、作物の生育への影響を解説します。' },
  generalWorkAdvice: { label: '畑しごと',   desc: '草取り・収穫・定植など外作業全般のタイミングや注意点を提案します。' },
  sprayingAdvice:    { label: '散布どき',   desc: '農薬・液肥の散布に適した風・雨の条件と最適時間帯を提案します。' },
  fertilizingAdvice: { label: '施肥どき',   desc: '粒状・粉場の肥料の施用タイミングを雨・土の状態から最適化して提案します。' },
  disasterPrep:      { label: '天気の備え', desc: '荒天・乾燥・低温など気候リスクと作物・施設への備えを提案します。' },
  custom:            { label: 'じぶん好み', desc: '自分でプロンプトを入力して、天気データに基づく任意の回答を取得できます。' },
};

const SECTION_ORDER: AiSection[] = [
  'weatherOverview', 'generalWorkAdvice', 'sprayingAdvice', 'fertilizingAdvice', 'disasterPrep', 'custom',
];

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

export function AiCommentSettings() {
  const { userSettings, updateEnabledAiSections, updateAiCustomPrompt } = useAppStore();

  const [enabledSections, setEnabledSections] = useState<AiSection[]>(
    userSettings?.enabledAiSections ?? DEFAULT_AI_SECTIONS
  );
  const [customPrompt, setCustomPrompt] = useState(
    userSettings?.aiCustomPrompt ?? ''
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ kind: 'idle' });

  useEffect(() => {
    if (userSettings) {
      setEnabledSections(userSettings.enabledAiSections ?? DEFAULT_AI_SECTIONS);
      setCustomPrompt(userSettings.aiCustomPrompt ?? '');
    }
  }, [userSettings]);

  const toggleSection = (section: AiSection, checked: boolean) => {
    setEnabledSections(prev =>
      checked
        ? prev.includes(section) ? prev : [...prev, section]
        : prev.filter(s => s !== section)
    );
  };

  const handleSave = async () => {
    setSaveStatus({ kind: 'saving' });
    try {
      await updateEnabledAiSections(enabledSections);
      await updateAiCustomPrompt(customPrompt);
      setSaveStatus({ kind: 'saved', msg: '保存しました' });
      setTimeout(() => setSaveStatus({ kind: 'idle' }), 2500);
    } catch (err: unknown) {
      setSaveStatus({
        kind: 'error',
        msg: `保存失敗: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  };

  const renderStatus = (status: SaveStatus) => {
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <h3 style={{ margin: '0 0 0.35rem', fontSize: '1rem' }}>表示するタブ</h3>
          <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            チェックを外したタブはAIコメントに表示されません。
          </p>
        </div>

        <div style={{
          border: '1px solid var(--card-border)',
          borderRadius: 'var(--radius-md, 8px)',
          overflow: 'hidden',
        }}>
          {SECTION_ORDER.map((section, idx) => {
            const info = SECTION_INFO[section];
            const isChecked = enabledSections.includes(section);
            const isLast = idx === SECTION_ORDER.length - 1;

            if (section === 'custom') {
              // カスタマイズ行: プロンプト入力エリアをチェックボックス行の内部に展開
              return (
                <div
                  key={section}
                  style={{
                    borderBottom: isLast ? 'none' : '1px solid var(--card-border)',
                    background: isChecked ? 'transparent' : 'rgba(0,0,0,0.02)',
                    transition: 'background 0.15s',
                  }}
                >
                  {/* チェックボックス + ラベル行 */}
                  <label style={{
                    display: 'flex',
                    gap: '0.75rem',
                    padding: '0.75rem 1rem 0.5rem',
                    cursor: 'pointer',
                  }}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={e => toggleSection(section, e.target.checked)}
                      style={{
                        width: '1rem',
                        height: '1rem',
                        marginTop: '0.15rem',
                        cursor: 'pointer',
                        flexShrink: 0,
                        accentColor: 'var(--accent-color)',
                      }}
                    />
                    <div style={{ flex: 1, opacity: isChecked ? 1 : 0.45, transition: 'opacity 0.15s' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.2rem' }}>
                        {info.label}
                      </div>
                      <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                        {info.desc}
                      </p>
                    </div>
                  </label>
                  {/* プロンプト入力エリア: チェック状態でテキスト部分に揃えてインデント */}
                  <div style={{
                    padding: '0 1rem 0.75rem 2.75rem',
                    opacity: isChecked ? 1 : 0.45,
                    transition: 'opacity 0.15s',
                  }}>
                    <div style={{ position: 'relative' }}>
                      <textarea
                        value={customPrompt}
                        onChange={e => setCustomPrompt(e.target.value.slice(0, MAX_CUSTOM_PROMPT))}
                        disabled={!isChecked}
                        placeholder="例: 今日の午後に農薬散布を計画しています。風速・降水確率を踏まえて実施できるか教えてください。"
                        rows={4}
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          padding: '0.75rem',
                          fontSize: '0.85rem',
                          lineHeight: 1.7,
                          borderRadius: 'var(--radius-md, 6px)',
                          border: '1px solid var(--card-border)',
                          background: isChecked ? 'var(--bg-primary)' : 'rgba(0,0,0,0.04)',
                          color: 'var(--text-primary)',
                          resize: 'vertical',
                          fontFamily: 'inherit',
                          cursor: isChecked ? 'text' : 'default',
                        }}
                      />
                      <div style={{
                        position: 'absolute',
                        bottom: '0.5rem',
                        right: '0.75rem',
                        fontSize: '0.72rem',
                        color: customPrompt.length >= MAX_CUSTOM_PROMPT ? '#c62828' : 'var(--text-secondary)',
                        pointerEvents: 'none',
                      }}>
                        {customPrompt.length} / {MAX_CUSTOM_PROMPT}
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <label
                key={section}
                style={{
                  display: 'flex',
                  gap: '0.75rem',
                  padding: '0.75rem 1rem',
                  borderBottom: isLast ? 'none' : '1px solid var(--card-border)',
                  cursor: 'pointer',
                  background: isChecked ? 'transparent' : 'rgba(0,0,0,0.02)',
                  transition: 'background 0.15s',
                }}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={e => toggleSection(section, e.target.checked)}
                  style={{
                    width: '1rem',
                    height: '1rem',
                    marginTop: '0.15rem',
                    cursor: 'pointer',
                    flexShrink: 0,
                    accentColor: 'var(--accent-color)',
                  }}
                />
                <div style={{ flex: 1, opacity: isChecked ? 1 : 0.45, transition: 'opacity 0.15s' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.2rem' }}>
                    {info.label}
                  </div>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    {info.desc}
                  </p>
                </div>
              </label>
            );
          })}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', paddingTop: '0.25rem' }}>
          {renderStatus(saveStatus)}
          <button
            onClick={handleSave}
            disabled={saveStatus.kind === 'saving'}
            style={{
              ...SAVE_BTN,
              cursor: saveStatus.kind === 'saving' ? 'not-allowed' : 'pointer',
              opacity: saveStatus.kind === 'saving' ? 0.6 : 1,
            }}
          >
            <Save size={14} /> 保存
          </button>
        </div>
      </div>
    </div>
  );
}
