import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@picocss/pico/css/pico.min.css'
import '@blocknote/mantine/style.css'
import './index.css'
import { WitPinsProvider } from './context/WitPinsContext'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WitPinsProvider>
      <App />
    </WitPinsProvider>
  </StrictMode>,
)
