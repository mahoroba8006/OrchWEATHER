export const CustomWideBar = (props: any) => {
  const { fill, x, y, width, height } = props;
  if (x === undefined || y === undefined || height === undefined || height <= 0) {
    return null;
  }
  // 日次の細い幅を無視して、月間用の太いバーを強制的に描画する
  const customWidth = 16; // 以前の24pxの約70%
  const offsetX = x + width / 2 - customWidth / 2;
  return (
    <rect 
      x={offsetX} 
      y={y} 
      width={customWidth} 
      height={height} 
      fill={fill} 
      fillOpacity={0.25} 
      rx={3} 
      ry={3}
    />
  );
};

export const CustomRangeBar = (props: any) => {
  const { fill, x, y, width, height } = props;
  if (x === undefined || y === undefined || height === undefined || height <= 0) {
    return null;
  }
  const centerX = x + width / 2;
  const capWidth = 2; // キャップの幅を短く変更
  return (
    <g opacity={0.38}>
      <line x1={centerX} y1={y} x2={centerX} y2={y + height} stroke={fill} strokeWidth={1.5} />
      <line x1={centerX - capWidth} y1={y} x2={centerX + capWidth} y2={y} stroke={fill} strokeWidth={1.5} />
      <line x1={centerX - capWidth} y1={y + height} x2={centerX + capWidth} y2={y + height} stroke={fill} strokeWidth={1.5} />
    </g>
  );
};

export const ForecastRangeBar = (props: any) => {
  const { fill, x, y, width, height } = props;
  if (x === undefined || y === undefined || height === undefined || height <= 0) {
    return null;
  }
  const centerX = x + width / 2;
  const capWidth = 2;
  return (
    <g opacity={0.48}>
      <line x1={centerX} y1={y} x2={centerX} y2={y + height} stroke={fill} strokeWidth={1.5} strokeDasharray="4 3" />
      <line x1={centerX - capWidth} y1={y} x2={centerX + capWidth} y2={y} stroke={fill} strokeWidth={1.5} />
      <line x1={centerX - capWidth} y1={y + height} x2={centerX + capWidth} y2={y + height} stroke={fill} strokeWidth={1.5} />
    </g>
  );
};

/** 端からこの距離(px)以内の目盛りは、文字を中央揃えにすると半分はみ出すので内側に揃える（"01/01" の半分の幅ほど） */
const X_TICK_EDGE = 16;

/**
 * 横軸の目盛りの文字。recharts は端からはみ出す目盛りを間引くため、左端の 1/1 が消えていた。
 * 間引かずに（interval=0）、左右の端にかかる目盛りだけ文字を内側へ揃えてはみ出さないようにする。
 * 横軸は左の余白0（縦軸は mirror でグラフに重ねている）なので、0〜width が描ける範囲
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function EdgeAwareXTick(props: any) {
  const { x, y, width, payload, index, tickFormatter } = props;
  const label = tickFormatter ? tickFormatter(payload.value, index) : payload.value;
  const anchor = x < X_TICK_EDGE ? 'start' : x > width - X_TICK_EDGE ? 'end' : 'middle';
  return (
    <text x={x} y={y} dy="0.71em" textAnchor={anchor} fontSize={11} style={{ fill: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums' }}>
      {label}
    </text>
  );
}
