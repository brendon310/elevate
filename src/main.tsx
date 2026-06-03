import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./app.css";
import { i18nReady } from './i18n';
import { ElevateApp } from "./App";
import { ErrorBoundary } from "./ErrorBoundary";

// Register service worker for push notifications
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

// Wait for the active locale to be ready, then mount (avoids a flash of English).
i18nReady.finally(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <ErrorBoundary>
        <ElevateApp />
      </ErrorBoundary>
    </StrictMode>
  );
});
