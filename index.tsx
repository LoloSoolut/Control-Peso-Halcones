import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';

const notify = (text: string) => {
  window.postMessage({ type: 'STATUS_UPDATE', text }, '*');
};

const setReady = () => {
  window.postMessage({ type: 'APP_READY' }, '*');
};

notify("Cargando Cetrería...");

const rootElement = document.getElementById('root');

if (rootElement) {
  try {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    
    // Pequeño retardo para asegurar que el navegador ha pintado la app antes de quitar el splash
    setTimeout(() => {
        setReady();
        console.log("Falcon: Sistema operativo");
    }, 150);
    
  } catch (err) {
    notify("Error de renderizado");
    console.error(err);
  }
}