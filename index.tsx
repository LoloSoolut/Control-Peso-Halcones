import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';

const notify = (text: string) => {
  window.postMessage({ type: 'STATUS_UPDATE', text }, '*');
};

const setReady = () => {
  window.postMessage({ type: 'APP_READY' }, '*');
};

notify("CONECTANDO...");

const rootElement = document.getElementById('root');

if (rootElement) {
  try {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    
    // Notificar éxito inmediato
    setTimeout(setReady, 50);
  } catch (err: any) {
    notify("FALLO CRÍTICO");
    console.error(err);
  }
} else {
    notify("NO ROOT FOUND");
}