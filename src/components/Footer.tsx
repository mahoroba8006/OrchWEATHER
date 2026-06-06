import { type CSSProperties } from 'react';

const FOOTER_STYLE: CSSProperties = {
  padding: '1.5rem 1rem',
  textAlign: 'center',
  fontSize: '0.72rem',
  color: '#c0c6d4',
  borderTop: '1px solid #ebeef5',
  marginTop: '1.5rem',
  background: '#fafbfd',
};

const LINK_STYLE: CSSProperties = {
  color: '#b0b8c9',
  textDecoration: 'none',
  margin: '0 0.6rem',
};

const LOGO_STYLE: CSSProperties = {
  display: 'block',
  fontSize: '0.9rem',
  fontWeight: 700,
  color: '#b0b8c9',
  letterSpacing: '0.04em',
  marginBottom: '0.5rem',
};

export function Footer() {
  return (
    <footer style={FOOTER_STYLE}>
      <span style={LOGO_STYLE}>Orch.Weather</span>
      <a href="/privacy-policy" style={LINK_STYLE}>プライバシーポリシー</a>
      <a href="/disclaimer" style={LINK_STYLE}>免責事項</a>
    </footer>
  );
}
