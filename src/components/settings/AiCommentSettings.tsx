import { useState, useEffect } from 'react';
import { useAppStore, DEFAULT_AI_SECTIONS, type AiSection } from '../../store';
import { DEFAULT_AI_CUSTOM_PROMPT } from '../../lib/userRepository';
import { SaveButton } from '../ui/SaveButton';
import { Toggle } from '../ui/Toggle';
import './settings.css';

type SaveStatus = { kind: 'idle' | 'saving' | 'saved' | 'error'; msg?: string };

const MAX_CUSTOM_PROMPT = 200;

interface SectionMeta { label: string; desc: string }

const SECTION_INFO: Record<AiSection, SectionMeta> = {
  weatherOverview:   { label: '空ごよみ',   desc: '今日・明日の天気概況と数日先の傾向、作物への影響を解説します。' },
  generalWorkAdvice: { label: '畑しごと',   desc: '管理作業・収穫・定植など外作業のタイミングと注意点を提案します。' },
  sprayingAdvice:    { label: '散布どき',   desc: '農薬・液肥の散布に適した条件から、作業のタイミングや時間帯を提案します。' },
  fertilizingAdvice: { label: '施肥どき',   desc: '粒状・粉状肥料の施用タイミングを雨・土の状態から最適化して提案します。' },
  custom:            { label: 'じぶん好み', desc: '自分でプロンプトを入力して、天気データに基づく任意の回答を取得できます。' },
};

const SECTION_ORDER: AiSection[] = [
  'weatherOverview', 'generalWorkAdvice', 'sprayingAdvice', 'fertilizingAdvice', 'custom',
];

export function AiCommentSettings() {
  const { userSettings, updateEnabledAiSections, updateAiCustomPrompt, aiAllowed } = useAppStore();

  // AI 利用が許可されていない（未ログイン／ログイン無料ユーザー）場合はすべて選択不可。
  const locked = !aiAllowed;

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
    if (status.kind !== 'error') return null;
    return <span className="set-error">{status.msg}</span>;
  };

  const renderRowHead = (section: AiSection) => {
    const info = SECTION_INFO[section];
    const isChecked = enabledSections.includes(section);
    return (
      <label className={locked ? 'set-row set-row--locked' : 'set-row'}>
        <div className={isChecked ? 'set-row__body' : 'set-row__body set-row__body--off'}>
          <div className="set-row__head">
            <span className="set-row__title">{info.label}</span>
          </div>
          <p className="set-row__desc">{info.desc}</p>
        </div>
        <span className="set-row__toggle">
          <Toggle
            hideLabel
            label={info.label}
            checked={isChecked}
            disabled={locked}
            onChange={v => toggleSection(section, v)}
          />
        </span>
      </label>
    );
  };

  return (
    <div className="set-card">
      <div>
        <h3 className="set-title">表示するタブ</h3>
        <p className="set-desc">
          チェックを外したタブはAIコメントに表示されません。
        </p>
      </div>

      {locked && (
        <div className="set-notice">
          空のアドバイスは近日提供予定の機能です。提供開始までは設定を変更できません。
        </div>
      )}

      <div className="set-list" style={{ opacity: locked ? 0.55 : 1 }}>
        {SECTION_ORDER.map(section => {
          if (section !== 'custom') {
            return <div key={section} className="set-row-group">{renderRowHead(section)}</div>;
          }
          // カスタマイズ行: プロンプト入力エリアをトグル行の内部に展開
          const isChecked = enabledSections.includes(section);
          return (
            <div key={section} className="set-row-group">
              {renderRowHead(section)}
              <div className={isChecked ? 'set-row-group__extra' : 'set-row-group__extra set-row__body--off'}>
                <div style={{ position: 'relative' }}>
                  <textarea
                    className="set-textarea"
                    value={customPrompt}
                    onChange={e => setCustomPrompt(e.target.value.slice(0, MAX_CUSTOM_PROMPT))}
                    disabled={!isChecked || locked}
                    placeholder={DEFAULT_AI_CUSTOM_PROMPT}
                    rows={6}
                  />
                  <div style={{
                    position: 'absolute',
                    bottom: '0.5rem',
                    right: '0.75rem',
                    fontSize: '0.72rem',
                    color: customPrompt.length >= MAX_CUSTOM_PROMPT ? '#c62828' : 'var(--ink-3)',
                    pointerEvents: 'none',
                  }}>
                    {customPrompt.length} / {MAX_CUSTOM_PROMPT}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="set-actions">
        {renderStatus(saveStatus)}
        <SaveButton
          onClick={handleSave}
          saving={saveStatus.kind === 'saving'}
          saved={saveStatus.kind === 'saved'}
          disabled={locked}
        />
      </div>
    </div>
  );
}
