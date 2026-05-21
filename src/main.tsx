import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./app.css";
import { ElevateApp } from "./App";

// Register service worker for push notifications
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ElevateApp />
  </StrictMode>
);
