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

export function Footer() {
  return (
    <footer style={FOOTER_STYLE}>
      <a href="/privacy-policy" style={LINK_STYLE}>プライバシーポリシー</a>
    </footer>
  );
}
