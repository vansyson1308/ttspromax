"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-center space-y-3">
          <p className="font-bold text-red-700 dark:text-red-300">Something went wrong</p>
          <p className="text-sm text-red-600 dark:text-red-400">
            {this.state.error?.message || "An unexpected error occurred."}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
