import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

// Service worker: enable for production, disable in development to avoid caching issues
if ('serviceWorker' in navigator) {
  if (process.env.NODE_ENV === 'production') {
    window.addEventListener('load', () => {
      // Register SW with the correct base path for subpath deployments (e.g., GitHub Pages)
      const publicUrl = process.env.PUBLIC_URL || '';
      const swUrl = `${publicUrl}/service-worker.js`;
      navigator.serviceWorker.register(swUrl).catch(() => {});
    });
  } else {
    // In dev, unregister any existing service workers and clear caches for this origin
    window.addEventListener('load', async () => {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        regs.forEach((r) => r.unregister());
        if (window.caches?.keys) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
      } catch {}
    });
  }
}
