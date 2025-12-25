import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.scss";
import App from "./App.jsx";

window.addEventListener('error', (event) => {
  if (event.message && event.message.includes('chunk') && event.message.includes('failed')) {
    console.error('[Chunk Load Error] Detected chunk loading failure:', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error
    });
    console.error('[Chunk Load Error] This may be due to:');
    console.error('  1. Network connectivity issues');
    console.error('  2. Cache corruption - try clearing browser cache');
    console.error('  3. Deployment issue - chunk may not exist on server');
    console.error('[Chunk Load Error] Attempting to reload page in 3 seconds...');
    
    setTimeout(() => {
      if (confirm('A resource failed to load. Would you like to reload the page?')) {
        window.location.reload();
      }
    }, 3000);
  }
  
  if (event.message && event.message.includes('Content Security Policy')) {
    console.warn('[CSP Warning] Content Security Policy violation detected');
    console.warn('[CSP Warning] This is likely from a browser extension, not our code');
    console.warn('[CSP Warning] Extension:', event.filename || 'unknown');
  }
});

window.addEventListener('unhandledrejection', (event) => {
  if (event.reason && event.reason.message && event.reason.message.includes('chunk')) {
    console.error('[Chunk Load Error] Unhandled promise rejection:', {
      reason: event.reason,
      message: event.reason.message
    });
  }
});

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
