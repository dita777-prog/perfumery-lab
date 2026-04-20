import { Component, ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-background text-foreground p-6">
          <div className="max-w-lg w-full bg-card border border-border rounded-lg p-6 space-y-3">
            <h2 className="text-lg font-semibold text-destructive">Something went wrong</h2>
            <p className="text-sm text-muted-foreground">
              The page hit an unexpected error. Your data is safe — reload to continue.
            </p>
            <pre className="text-xs bg-secondary rounded p-3 overflow-auto max-h-48 whitespace-pre-wrap">
              {this.state.error.message}
            </pre>
            <div className="flex gap-2">
              <button
                className="px-3 py-1.5 text-sm rounded bg-[hsl(183,70%,36%)] text-black hover:bg-[hsl(183,70%,50%)] transition-colors"
                onClick={this.reset}
              >
                Try again
              </button>
              <button
                className="px-3 py-1.5 text-sm rounded bg-secondary text-foreground hover:bg-secondary/80 transition-colors"
                onClick={() => window.location.reload()}
              >
                Reload page
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
