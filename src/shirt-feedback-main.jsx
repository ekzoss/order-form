import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import ShirtFeedbackApp from './shirt-feedback.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ShirtFeedbackApp />
  </StrictMode>,
);

// Made with Bob
