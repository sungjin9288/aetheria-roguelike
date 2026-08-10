import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { FatalErrorBoundary } from './components/app/FatalErrorBoundary';
import {
  bindGlobalErrorReporter,
  getRuntimeErrorReporter,
  readKnownRuntimeScriptFilenames,
} from './platform/errorReporter';
import { getRuntimeProductEventContext } from './platform/productEventContext';
import { registerServiceWorker } from './pwa/registerServiceWorker';

registerServiceWorker();

const errorContext = getRuntimeProductEventContext();
const knownScriptFilenames = readKnownRuntimeScriptFilenames();
if (errorContext) {
  bindGlobalErrorReporter({
    target: window,
    context: errorContext,
    reporter: { capture: (report) => getRuntimeErrorReporter().capture(report) },
    knownScriptFilenames,
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FatalErrorBoundary knownScriptFilenames={knownScriptFilenames}>
      <App />
    </FatalErrorBoundary>
  </StrictMode>
);
