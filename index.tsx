import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

console.log("FalconWeight: index.tsx cargado correctamente.");

const updateStatus = (text: string) => {
  const el = document.getElementById('progress-msg');
  if (el) el.innerText = text;
};

const rootElement = document.getElementById('root');

if (rootElement) {
  try {
    updateStatus("Iniciando Interfaz...");
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    console.log("FalconWeight: Render finalizado.");
  } catch (err: any) {
    updateStatus("Error al renderizar");
    const errorBox = document.getElementById('error-box');
    if (errorBox) {
        errorBox.style.display = 'block';
        errorBox.innerText = "Render Error: " + err.message;
    }
    console.error("Error en render:", err);
  }
} else {
  console.error("No se encontró el elemento root en el DOM");
}