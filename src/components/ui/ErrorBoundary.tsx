import { Component, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  /** error は原因の表示用（真っ白にせず、何が起きたかを見せる） */
  fallback: (reset: () => void, error: Error | null) => ReactNode;
  onError?: (error: Error) => void;
  children: ReactNode;
}

/** 子の描画中の例外（遅延読み込み失敗など）で画面全体が落ちないよう保護する */
export class ErrorBoundary extends Component<ErrorBoundaryProps, { failed: boolean; error: Error | null }> {
  state: { failed: boolean; error: Error | null } = { failed: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { failed: true, error };
  }

  componentDidCatch(error: Error) {
    this.props.onError?.(error);
  }

  reset = () => this.setState({ failed: false, error: null });

  render() {
    return this.state.failed ? this.props.fallback(this.reset, this.state.error) : this.props.children;
  }
}
