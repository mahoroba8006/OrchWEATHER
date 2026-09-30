/**
 * src/components/weather/JmaWarningSummary.tsx
 *
 * 気象庁の注意報・警報を表示するサマリーコンポーネント。
 * WeatherTab で RiskSummary の上部に配置する。
 */

import { m } from 'motion/react';
import { springs } from '../../lib/motion';
import './warning.css';
import type { JmaWarningResult, JmaWarningItem, WarningLevel } from '../../api/jmaWarning';

interface Props {
  result: JmaWarningResult | null;
  loading: boolean;
}

/** 警報レベルに応じた意味色（既存の色値を流用）。bar=左端の帯、tint=種別チップの地、text=チップの文字 */
const LEVEL_STYLE: Record<WarningLevel, { bar: string; tint: string; text: string; label: string }> = {
  special:  { bar: 'rgb(220,38,127)', tint: 'rgba(220,38,127,0.12)', text: '#6d1a3e', label: '特別警報' },
  warning:  { bar: 'rgb(239,68,68)',  tint: 'rgba(239,68,68,0.12)',  text: '#9b2226', label: '警報' },
  advisory: { bar: 'rgb(251,146,60)', tint: 'rgba(251,146,60,0.16)', text: '#7c4b00', label: '注意報' },
  none:     { bar: 'transparent',     tint: 'transparent',           text: 'var(--ink-2)', label: '' },
};

function WarningRow({ item }: { item: JmaWarningItem }) {
  const style = LEVEL_STYLE[item.level];

  // 発表: バッジ「発表」＋発表時刻を表示 / 継続・更新: バッジ「継続中」のみ（時刻なし）
  const isIssued = item.status === '発表';
  const badgeText = item.status ? (isIssued ? '発表' : '継続中') : null;
  const timeText = isIssued && item.validPeriod
    ? item.validPeriod.replace(/〜\s*$/, '')
    : null;
  // 警報・特別警報のみ、帯が3回だけ脈動する（注意報は静止）
  const pulse = item.level === 'warning' || item.level === 'special';

  return (
    <div className="warn-row" data-level={item.level}>
      <m.span
        aria-hidden="true"
        className={pulse ? 'warn-row__bar warn-row__bar--pulse' : 'warn-row__bar'}
        style={{ background: style.bar }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={springs.move}
      />
      <span className="warn-row__chip" style={{ color: style.text, background: style.tint }}>
        {style.label}
      </span>
      <span className="warn-row__name">{item.name}</span>
      {badgeText && <span className="warn-row__status">{badgeText}</span>}
      {timeText && <span className="warn-row__time">{timeText}</span>}
    </div>
  );
}

export function JmaWarningSummary({ result, loading }: Props) {
  // ロード中かつデータ未取得の場合は非表示（既存の RiskSummary を邪魔しない）
  if (loading && !result) return null;

  // データなし（エリアコード未設定 or API未到達）は非表示
  if (!result) return null;

  // 発表なし: 非表示
  if (result.items.length === 0) return null;

  // 警報レベル順でソート: special > warning > advisory
  const levelOrder: Record<WarningLevel, number> = { special: 0, warning: 1, advisory: 2, none: 3 };
  const sorted = [...result.items].sort((a, b) => levelOrder[a.level] - levelOrder[b.level]);

  const reportTime = result.reportDatetime
    ? (() => {
        const d = new Date(result.reportDatetime);
        const jst = new Date(d.getTime() + 9 * 60 * 60000);
        return `${jst.getUTCMonth() + 1}/${jst.getUTCDate()} ${String(jst.getUTCHours()).padStart(2, '0')}:${String(jst.getUTCMinutes()).padStart(2, '0')} 時点`;
      })()
    : null;

  return (
    <section className="warn-card">
      <div className="warn-card__head">
        <span className="warn-card__title">気象庁 注意報・警報</span>
        {reportTime && <span className="warn-card__time">{reportTime}</span>}
      </div>
      <div className="warn-card__list">
        {sorted.map((item) => (
          <WarningRow key={item.code} item={item} />
        ))}
      </div>
    </section>
  );
}
