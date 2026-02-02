import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';

// Feedback visual inmediato de que el JS ha tomado el control
const progressMsg = document.getElementById('progress-msg');
if (progressMsg) progressMsg.innerText = "Iniciando React 18...";

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Target container 'root' not found");
}

const root = ReactDOM.createRoot(rootElement);

try {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  console.log("FalconWeight: Render inicial completado");
} catch (e) {
  console.error("FalconWeight: Fallo en el render", e);
}
