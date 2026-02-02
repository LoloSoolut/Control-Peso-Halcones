import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';

console.log("Falcon: Iniciando Interfaz");

const rootElement = document.getElementById('root');

if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  console.log("Falcon: Sistema Listo");
}