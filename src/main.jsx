import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ThemeProvider } from './contexts/ThemeContext';
import { SyncStatusProvider } from './contexts/SyncStatusContext';
import './index.css';

// TitleBar is rendered inside App.jsx — do NOT render it here too.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <SyncStatusProvider>
        <App />
      </SyncStatusProvider>
    </ThemeProvider>
  </React.StrictMode>
);