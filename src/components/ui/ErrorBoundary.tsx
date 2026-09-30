import { Component, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  fallback: (reset: () => void) => ReactNode;
  onError?: (error: Error) => void;
  children: ReactNode;
}

/** 子の描画中の例外（遅延読み込み失敗など）で画面全体が落ちないよう保護する */
export class ErrorBoundary extends Component<ErrorBoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    this.props.onError?.(error);
  }

  reset = () => this.setState({ failed: false });

  render() {
    return this.state.failed ? this.props.fallback(this.reset) : this.props.children;
  }
}
