import { useState, useEffect } from 'react';
import { RotateCcw } from 'lucide-react';
import { useAppStore, ALL_JMA_GROUPS, type JmaWarningGroup } from '../../store';
import { Button } from '../ui/Button';
import { SaveButton } from '../ui/SaveButton';
import { Toggle } from '../ui/Toggle';
import './settings.css';

type SaveStatus = { kind: 'idle' | 'saving' | 'saved' | 'error'; msg?: string };
type LevelTag = 'advisory' | 'warning' | 'special';

const LEVEL_LABEL: Record<LevelTag, string> = {
  advisory: '注意報のみ',
  warning:  '注意報〜警報',
  special:  '注意報〜特別警報',
};

const LEVEL_STYLE: Record<LevelTag, { color: string; bg: string; border: string }> = {
  advisory: { color: '#7c4b00', bg: 'rgba(251,146,60,0.12)', border: 'rgba(251,146,60,0.5)' },
  warning:  { color: '#9b2226', bg: 'rgba(239,68,68,0.10)',  border: 'rgba(239,68,68,0.45)' },
  special:  { color: '#6d1a3e', bg: 'rgba(220,38,127,0.09)', border: 'rgba(220,38,127,0.4)' },
};

interface GroupMeta { desc: string; level: LevelTag }

const GROUP_INFO: Record<JmaWarningGroup, GroupMeta> = {
  '大雨': {
    level: 'special',
    desc: '短時間または継続した強雨により、土砂災害・農地冠水・河川増水の恐れ。圃場の排水状況確認と低地施設への浸水対策が必要。',
  },
  '土砂災害': {
    level: 'warning',
    desc: '大雨や長雨により地盤が緩み、土砂崩れ・がけ崩れ・地すべりの恐れ。斜面に隣接した農地・施設は特に注意が必要。早めの退避と圃場への立ち入り中止を検討。',
  },
  '洪水': {
    level: 'warning',
    desc: '上流域の降雨により河川が増水・氾濫する恐れ。現地が晴れていても発令されることがあり、河川沿いの農地・施設は注意が必要。',
  },
  '融雪': {
    level: 'advisory',
    desc: '急速な融雪により河川増水・農地の湛水・土砂流出が発生しやすくなる。排水路・農業用水路の点検と低地農地への浸水対策が必要。',
  },
  '大雪': {
    level: 'special',
    desc: '大量積雪によりビニールハウス・温室などの施設に荷重がかかり倒壊リスク。除雪作業の計画と農業機械の格納を要確認。',
  },
  '強風': {
    level: 'special',
    desc: '強い風（暴風を含む）により施設損壊・作物の倒伏・落果の恐れ。ハウスの固定状況確認、支柱の補強、換気窓の閉鎖が必要。',
  },
  '風雪': {
    level: 'special',
    desc: '雪を伴う強風（吹雪）により視界不良と施設への雪の吹き付け・積雪が同時に発生。屋外作業の中断と施設の密閉・固定が必要。',
  },
  'なだれ': {
    level: 'advisory',
    desc: '積雪の不安定化により山腹・急斜面での雪崩発生の恐れ。山地に隣接する農地や農道の安全確認と、積雪期の山間での作業中断が必要。',
  },
  '着氷': {
    level: 'advisory',
    desc: '過冷却した雨粒や霧が枝・電線などに付着し、重みによる折れ・断線の恐れ。果樹の枝折れリスクとポンプ・灌漑設備への影響確認が必要。',
  },
  '着雪': {
    level: 'advisory',
    desc: '湿った重い雪が施設・果樹・電線に付着し、荷重による倒壊・枝折れの恐れ。着氷より水分量が多く重みが出やすいため早めの除雪が重要。',
  },
  '乾燥': {
    level: 'advisory',
    desc: '空気が著しく乾燥し、作物の水分ストレスと火災リスクが増大。灌水計画の見直しと農業施設周辺での火気管理が必要。',
  },
  '霜': {
    level: 'advisory',
    desc: '気温低下により地表付近に霜が発生し、植物組織が凍結・破壊される恐れ。開花期・育苗中など低温に敏感な時期は特に注意が必要。',
  },
  '低温': {
    level: 'advisory',
    desc: '異常な低温の継続により生育遅延・冷害・凍害のリスク。積算温度の管理に影響が出るため、作業計画や加温対策の見直しが必要。',
  },
  '雷': {
    level: 'advisory',
    desc: '落雷とともに急激な天候変化（突風・ひょう）を伴う場合がある。屋外作業・農業機械の中断と、ポンプ・センサー類の電気系統の保護が必要。',
  },
  '濃霧': {
    level: 'advisory',
    desc: '濃い霧による視界不良に加え、高湿度環境が継続することで灰色かび病などの病害リスクが上昇。農作業時の安全確認とハウス内の換気管理に注意。',
  },
  '波浪': {
    level: 'special',
    desc: '高波により沿岸部の農地・施設への越波・浸水の恐れ。沿岸農地や漁業関連施設の管理に有用で、内陸部では直接影響は少ない。',
  },
  '高潮': {
    level: 'special',
    desc: '台風・低気圧による海面上昇で干拓地や海岸低地への浸水リスク。沿岸農地では深刻な被害になる場合があり、内陸部では影響なし。',
  },
};

const GROUP_SECTIONS: { label: string; groups: JmaWarningGroup[] }[] = [
  { label: '雨・洪水',  groups: ['大雨', '土砂災害', '洪水', '融雪'] },
  { label: '雪・風',    groups: ['大雪', '強風', '風雪', 'なだれ', '着氷', '着雪'] },
  { label: '気温・大気', groups: ['乾燥', '霜', '低温', '雷', '濃霧'] },
  { label: '沿岸',      groups: ['波浪', '高潮'] },
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
    if (status.kind !== 'error') return null;
    return <span className="set-error">{status.msg}</span>;
  };

  return (
    <div className="set-card">
      <div>
        <h3 className="set-title">注意報・警報の表示設定</h3>
        <p className="set-desc">
          チェックを外した種別は天気情報タブに表示されません。特別警報は常に表示されます。
        </p>
      </div>

      {GROUP_SECTIONS.map(section => (
        <div key={section.label}>
          <div className="set-subhead">{section.label}</div>

          <div className="set-list">
            {section.groups.map(group => {
              const info = GROUP_INFO[group];
              const isChecked = enabled.includes(group);
              const lvStyle = LEVEL_STYLE[info.level];

              return (
                <label key={group} className="set-row">
                  <div className={isChecked ? 'set-row__body' : 'set-row__body set-row__body--off'}>
                    <div className="set-row__head">
                      <span className="set-row__title">{group}</span>
                      <span
                        className="set-chip"
                        style={{ color: lvStyle.color, background: lvStyle.bg, border: `1px solid ${lvStyle.border}` }}
                      >
                        {LEVEL_LABEL[info.level]}
                      </span>
                    </div>
                    <p className="set-row__desc">{info.desc}</p>
                  </div>
                  <span className="set-row__toggle">
                    <Toggle
                      hideLabel
                      label={group}
                      checked={isChecked}
                      onChange={v => toggle(group, v)}
                    />
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      ))}

      <div className="set-actions set-actions--split">
        <Button
          variant="secondary"
          className="set-btn-sm"
          onClick={handleReset}
          disabled={status.kind === 'saving'}
        >
          <RotateCcw size={13} /> すべて表示に戻す
        </Button>
        <div className="set-actions__right">
          {renderStatus()}
          <SaveButton
            onClick={() => handleSave(enabled)}
            saving={status.kind === 'saving'}
            saved={status.kind === 'saved'}
          />
        </div>
      </div>
    </div>
  );
}
