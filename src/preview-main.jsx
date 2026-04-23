import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import PreviewApp from './preview.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <PreviewApp />
  </StrictMode>,
);

// Made with Bob
