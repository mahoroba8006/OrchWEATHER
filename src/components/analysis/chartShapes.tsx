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
    <g opacity={0.4}>
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
    <g opacity={0.7}>
      <line x1={centerX} y1={y} x2={centerX} y2={y + height} stroke={fill} strokeWidth={1.5} strokeDasharray="5 4" />
      <line x1={centerX - capWidth} y1={y} x2={centerX + capWidth} y2={y} stroke={fill} strokeWidth={1.5} />
      <line x1={centerX - capWidth} y1={y + height} x2={centerX + capWidth} y2={y + height} stroke={fill} strokeWidth={1.5} />
    </g>
  );
};
