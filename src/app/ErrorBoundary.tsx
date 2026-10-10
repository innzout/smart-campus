import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertOctagon, RotateCcw } from 'lucide-react';

interface State {
  error: Error | null;
}

/**
 * Last line of defence. A render crash inside a page shouldn't leave the user
 * looking at a blank white screen with no way out.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled render error:', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex min-h-dvh items-center justify-center bg-plane px-5 py-16">
        <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-7 text-center shadow-pop">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[--color-critical]/12 text-[--color-critical]">
            <AlertOctagon className="size-7" />
          </span>
          <h1 className="mt-5 text-[19px] font-semibold text-ink">Something broke</h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-ink-2">
            The page hit an unexpected error and stopped rendering. Reloading usually clears it — your
            local data is untouched.
          </p>
          <pre className="mt-4 max-h-32 overflow-auto rounded-xl bg-surface-2 px-3.5 py-3 text-left text-[11.5px] leading-relaxed text-ink-3">
            {error.message}
          </pre>
          <div className="mt-5 flex justify-center gap-2">
            <button
              onClick={() => this.setState({ error: null })}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-surface-2 px-4 text-sm font-medium text-ink transition-colors hover:bg-surface-hover"
            >
              Try again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-medium text-white transition-colors hover:bg-brand-500"
            >
              <RotateCcw className="size-4" />
              Reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}
