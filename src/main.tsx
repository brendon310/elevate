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

// Sentry error monitoring — no-op unless VITE_SENTRY_DSN is set.
// Surfaces frontend crashes that today die silently (handoff trap #4).
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;
if (SENTRY_DSN) {
  import('@sentry/react')
    .then(Sentry => {
      Sentry.init({ dsn: SENTRY_DSN, tracesSampleRate: 0.1, environment: import.meta.env.MODE });
    })
    .catch(() => { /* monitoring must never break the app */ });
}

// PostHog analytics — no-op unless VITE_POSTHOG_KEY is set.
// Loaded dynamically so it never weighs on the initial bundle.
// plans.ts trackEvent() reads window.posthog, so this is the only wiring needed.
const PH_KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
if (PH_KEY) {
  const PH_HOST = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ?? 'https://eu.i.posthog.com';
  import('posthog-js')
    .then(({ default: posthog }) => {
      posthog.init(PH_KEY, {
        api_host: PH_HOST,
        autocapture: false,
        capture_pageview: true,
        persistence: 'localStorage',
      });
      (window as unknown as { posthog: unknown }).posthog = posthog;
    })
    .catch(() => { /* analytics must never break the app */ });
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
