"use client";

import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, message: error.message };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("ErrorBoundary caught an error:", error, info);
  }

  override render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: "1rem", background: "#1a1a2e", color: "#ddd" }}>
        <p style={{ color: "#ef4444" }}>Something went wrong.</p>
        <code style={{ color: "#888", fontSize: "0.85rem", maxWidth: "40rem", textAlign: "center" }}>{this.state.message}</code>
        <button
          onClick={() => {
            this.setState({ hasError: false, message: "" });
            this.props.onReset?.();
          }}
          style={{ padding: "0.5rem 1rem", background: "#6366f1", color: "white", border: "none", borderRadius: "0.375rem", cursor: "pointer" }}
        >
          Try again
        </button>
      </div>
    );
  }
}