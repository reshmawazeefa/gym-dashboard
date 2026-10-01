import { Component } from "react";
import { notifyError } from "../services/toastNotifications";

export default class GlobalErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    notifyError(error?.message || "Something went wrong");
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
          <section className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-[0_14px_35px_rgba(15,23,42,0.10)] ring-1 ring-slate-100">
            <h1 className="text-lg font-semibold text-slate-900">Something went wrong</h1>
            <p className="mt-2 text-sm text-slate-500">Please refresh the page and try again.</p>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
