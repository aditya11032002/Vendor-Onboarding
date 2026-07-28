import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Globally intercept fetch requests and prepend the backend URL from environment variables
const apiBase = import.meta.env.VITE_API_URL || '';
if (apiBase) {
  const originalFetch = window.fetch;
  window.fetch = async (input, init) => {
    let url = input;
    if (typeof input === 'string' && input.startsWith('/api')) {
      url = `${apiBase.replace(/\/$/, '')}${input}`;
    }
    return originalFetch(url, init);
  };
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

