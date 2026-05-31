import { Component, ReactNode } from "react";
import { useTranslation } from "react-i18next";

// Functional component for the error UI — hooks work here
function ErrorFallback({ onReload }: { onReload: () => void }) {
  const { t } = useTranslation();
  return (
    <div style={{
      minHeight: "100dvh",
      background: "#0a0a0f",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "32px",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      color: "#fff",
      textAlign: "center",
      gap: "16px"
    }}>
      <div style={{ fontSize: "40px" }}>⚡</div>
      <h2 style={{ margin: 0, fontWeight: 700, fontSize: "20px" }}>{t('error.title')}</h2>
      <p style={{ margin: 0, color: "#888", fontSize: "14px", maxWidth: "300px" }}>
        {t('error.body')}
      </p>
      <button
        onClick={onReload}
        style={{
          marginTop: "8px",
          padding: "12px 28px",
          background: "#3b82f6",
          color: "#fff",
          border: "none",
          borderRadius: "10px",
          fontSize: "15px",
          fontWeight: 600,
          cursor: "pointer"
        }}
      >
        {t('error.reload')}
      </button>
    </div>
  );
}

interface Props { children: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback onReload={() => window.location.reload()} />;
    }
    return this.props.children;
  }
}
