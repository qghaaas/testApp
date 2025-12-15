import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import MainRouters from './MainRouters'



createRoot(document.getElementById('root')).render(
  <StrictMode>
    <MainRouters />
  </StrictMode>,
)
