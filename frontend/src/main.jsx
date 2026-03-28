import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/globals.css'
import './styles/adaptive.css'

// Reapply mode on initial load before React mounts
// This helps prevent "flash of unstyled content" for accessibility modes
try {
  const persistedData = localStorage.getItem('bintangai-accessibility');
  if (persistedData) {
    const { state } = JSON.parse(persistedData);
    const savedMode = state?.mode;

    if (savedMode) {
      const root = document.documentElement;
      root.classList.add(`${savedMode}-mode`);
      root.setAttribute('data-disability', savedMode);

      if (savedMode === 'tunanetra') {
        root.style.fontSize = '125%';
      } else if (savedMode === 'tunarungu') {
        root.style.fontSize = '115%';
      }
    }
  }
} catch (e) {
  console.error("Failed to reapply accessibility mode on boot", e);
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
