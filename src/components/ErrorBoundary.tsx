/**
 * ErrorBoundary Component
 *
 * React Error Boundary to gracefully handle component crashes.
 * Prevents the entire application from going white on error.
 * Provides users with options to recover or export their data.
 */

import { Component, ReactNode, ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  componentName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error to console for debugging
    console.error(`ErrorBoundary caught an error in ${this.props.componentName || 'component'}:`, error, errorInfo);

    // Update state with error details
    this.setState({
      error,
      errorInfo,
    });

    // TODO: Send error to logging service (e.g., Sentry, LogRocket)
    // Example: logErrorToService(error, errorInfo);
  }

  handleReload = () => {
    // Reload the page to recover from the error
    window.location.reload();
  };

  handleReset = () => {
    // Reset the error boundary state to try rendering again
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleExportData = () => {
    // Export application state for recovery
    try {
      const stateData = {
        timestamp: new Date().toISOString(),
        error: this.state.error?.message,
        stack: this.state.error?.stack,
        componentStack: this.state.errorInfo?.componentStack,
      };

      const dataStr = JSON.stringify(stateData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `error-report-${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      alert('Error report downloaded. Please share this file if reporting the issue.');
    } catch (e) {
      console.error('Failed to export error data:', e);
      alert('Failed to export error report.');
    }
  };

  override render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="flex flex-col items-center justify-center h-full bg-milk-darkest text-milk-lightest p-8">
          <div className="max-w-2xl w-full bg-milk-dark rounded-lg border border-red-500/30 p-6 shadow-xl">
            {/* Error Icon */}
            <div className="flex items-center gap-3 mb-4">
              <svg
                className="w-8 h-8 text-red-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <h1 className="text-2xl font-bold text-red-400">Something Went Wrong</h1>
            </div>

            {/* Error Message */}
            <p className="text-milk-light mb-4">
              An error occurred in the{' '}
              <span className="font-mono text-milk-lightest">
                {this.props.componentName || 'application'}
              </span>
              . Don't worry, your data should still be safe.
            </p>

            {/* Error Details (Collapsible) */}
            {this.state.error && (
              <details className="mb-6 bg-milk-darkest rounded p-3 border border-milk-slate/30">
                <summary className="cursor-pointer text-milk-slate-light hover:text-milk-light font-semibold mb-2">
                  Show Technical Details
                </summary>
                <div className="mt-2 space-y-2">
                  <div>
                    <p className="text-xs text-milk-slate-light mb-1">Error Message:</p>
                    <pre className="text-xs text-red-400 bg-black/30 p-2 rounded overflow-x-auto">
                      {this.state.error.message}
                    </pre>
                  </div>
                  {this.state.error.stack && (
                    <div>
                      <p className="text-xs text-milk-slate-light mb-1">Stack Trace:</p>
                      <pre className="text-xs text-milk-slate bg-black/30 p-2 rounded overflow-x-auto max-h-40">
                        {this.state.error.stack}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3">
              <button
                onClick={this.handleReload}
                className="px-4 py-2 bg-milk-slate hover:bg-milk-slate-dark text-white rounded-lg font-medium transition-colors"
              >
                Reload Page
              </button>
              <button
                onClick={this.handleReset}
                className="px-4 py-2 bg-milk-dark-light hover:bg-milk-slate/30 text-milk-light rounded-lg font-medium transition-colors border border-milk-slate/30"
              >
                Try Again
              </button>
              <button
                onClick={this.handleExportData}
                className="px-4 py-2 bg-milk-dark-light hover:bg-milk-slate/30 text-milk-light rounded-lg font-medium transition-colors border border-milk-slate/30"
              >
                Export Error Report
              </button>
            </div>

            {/* Help Text */}
            <p className="mt-6 text-sm text-milk-slate-light">
              If this problem persists, please export the error report and contact support.
            </p>
          </div>
        </div>
      );
    }

    // No error, render children normally
    return this.props.children;
  }
}

export default ErrorBoundary;
