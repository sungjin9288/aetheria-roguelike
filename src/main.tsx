import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { FatalErrorBoundary } from './components/app/FatalErrorBoundary';
import {
  bindGlobalErrorReporter,
  composeErrorReporters,
  getRuntimeErrorReporter,
  installRuntimeErrorReporter,
  readKnownRuntimeScriptFilenames,
} from './platform/errorReporter';
import { createLocalErrorReporter } from './platform/localErrorReportStore';
import { getRuntimeProductEventContext } from './platform/productEventContext';
import { createSentryErrorReporter } from './platform/sentryErrorReporter';
import { registerServiceWorker } from './pwa/registerServiceWorker';
import { markPerfOnce } from './utils/performanceMarks';

markPerfOnce('aetheria:app-mounted');
registerServiceWorker();

// 리포터를 전역 에러 핸들러 바인딩 전에 설치한다 — 기기 안의 링버퍼(E1)에 남기고,
// 빌드에 Sentry DSN이 있으면 정리된 리포트만 Sentry로도 보낸다(DSN이 없으면 기기 안에만).
installRuntimeErrorReporter(composeErrorReporters(
  createLocalErrorReporter(),
  createSentryErrorReporter({ dsn: import.meta.env.VITE_SENTRY_DSN }),
));

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
