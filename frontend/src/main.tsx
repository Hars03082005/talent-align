import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { Workspace } from './workspace/Workspace';
import '@fontsource-variable/inter/wght.css';
import '@fontsource-variable/manrope/wght.css';
import './index.css';
import './workspace/workspace.css';

const useLegacy = import.meta.env.MODE !== 'site' && /^\/legacy(?:\/|$)/.test(location.pathname);
const Legacy = useLegacy ? React.lazy(() => import('./App')) : null;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {Legacy ? <Suspense fallback={null}><Legacy basename="/legacy" /></Suspense> : <Workspace />}
  </React.StrictMode>
);
