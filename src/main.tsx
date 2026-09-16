import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { FatalErrorBoundary } from './components/app/FatalErrorBoundary';
import {
  bindGlobalErrorReporter,
  getRuntimeErrorReporter,
  installRuntimeErrorReporter,
  readKnownRuntimeScriptFilenames,
} from './platform/errorReporter';
import { createLocalErrorReporter } from './platform/localErrorReportStore';
import { getRuntimeProductEventContext } from './platform/productEventContext';
import { registerServiceWorker } from './pwa/registerServiceWorker';

registerServiceWorker();

// 로컬 링버퍼 리포터를 전역 에러 핸들러 바인딩 전에 설치한다 — 백엔드 에러 수집
// 엔드포인트가 없으므로(E1) 기기 안에만 크래시 리포트를 남겨 둔다.
installRuntimeErrorReporter(createLocalErrorReporter());

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
