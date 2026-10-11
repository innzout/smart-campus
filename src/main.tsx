import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App';
import { hydrate } from './lib/store';
import './index.css';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element in index.html');

// Load any saved copy of the database before the first render, so a reload
// mid-demo comes back to exactly what was on screen.
await hydrate();

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
