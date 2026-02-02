import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';

// Feedback visual de que el JS se está ejecutando
const progressMsg = document.getElementById('progress-msg');
if (progressMsg) {
  progressMsg.innerText = "Iniciando Interfaz...";
}

const rootElement = document.getElementById('root');

if (rootElement) {
  try {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    console.log("FalconWeight: Renderizado con éxito.");
  } catch (err) {
    if (progressMsg) progressMsg.innerText = "Error en render: " + err;
    console.error(err);
  }
} else {
  console.error("No se encontró el elemento root");
}