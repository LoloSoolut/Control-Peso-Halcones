import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';

console.log("Iniciando index.tsx...");

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error("No se encontró el elemento #root");
  throw new Error("Could not find root element to mount to");
}

try {
  console.log("Creando root de React...");
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  console.log("Renderizado de React enviado.");
} catch (error) {
  console.error("Error durante el renderizado inicial:", error);
}
