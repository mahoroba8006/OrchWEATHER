export function WeatherSettings() {
  return (
    <div
      className="glass-panel"
      style={{
        padding: '2rem 1.5rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.75rem',
        textAlign: 'center',
        color: 'var(--text-secondary)',
      }}
    >
      <span style={{ fontSize: '2rem' }}>🌿</span>
      <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>リスク閾値の設定は準備中です</div>
      <div style={{ fontSize: '0.82rem', lineHeight: 1.6, maxWidth: 320 }}>
        霜・強風・大雨などの判定基準を
        ユーザーがカスタマイズできるようになります。
      </div>
    </div>
  );
}
