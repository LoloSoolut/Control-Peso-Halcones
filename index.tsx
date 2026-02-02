import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';

const notify = (text: string) => {
  window.postMessage({ type: 'STATUS_UPDATE', text }, '*');
};

const setReady = () => {
  window.postMessage({ type: 'APP_READY' }, '*');
};

notify("Sincronizando...");

const rootElement = document.getElementById('root');

if (rootElement) {
  try {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    
    // Notificar éxito
    setTimeout(() => {
        setReady();
        console.log("Falcon: Ready");
    }, 100);
    
  } catch (err: any) {
    notify("Error de inicio");
    console.error("Critical Start Error:", err);
  }
}