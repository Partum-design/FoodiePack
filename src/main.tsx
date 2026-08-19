import React, { lazy, Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource/fredoka/500.css'
import '@fontsource/fredoka/600.css'
import '@fontsource/fredoka/700.css'
import '@fontsource/dm-sans/400.css'
import '@fontsource/dm-sans/500.css'
import '@fontsource/dm-sans/600.css'
import '@fontsource/dm-sans/700.css'
import './styles.css'
import App from './App'

const AdminApp = lazy(() => import('./AdminApp'))
const isAdminRoute = window.location.pathname.replace(/\/$/, '') === '/gestion-cocina'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Suspense fallback={<div className="route-loading">Cargando…</div>}>
      {isAdminRoute ? <AdminApp /> : <App />}
    </Suspense>
  </React.StrictMode>,
)
