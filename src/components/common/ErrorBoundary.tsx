import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * Catches render errors in its children so one broken page/section shows an
 * error message instead of unmounting the whole app (blank screen).
 */
export default class ErrorBoundary extends Component<
  { children: ReactNode; resetKey?: unknown },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Page crashed:', error, info.componentStack);
  }

  componentDidUpdate(prev: { resetKey?: unknown }) {
    // Clear the error when navigating to another route.
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="m-6 rounded border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
        <div className="font-semibold">Something went wrong on this page.</div>
        <div className="mt-1 font-mono text-xs opacity-80">{this.state.error.message}</div>
        <button
          onClick={() => this.setState({ error: null })}
          className="mt-3 rounded border border-red-400/40 px-3 py-1 text-xs hover:bg-red-500/20"
        >
          Try again
        </button>
      </div>
    );
  }
}
