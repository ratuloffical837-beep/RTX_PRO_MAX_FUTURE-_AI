import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

// Telegram WebApp Init
if (window.Telegram?.WebApp) {
  window.Telegram.WebApp.ready()
  window.Telegram.WebApp.expand()
  window.Telegram.WebApp.setHeaderColor('#0a0e17')
  window.Telegram.WebApp.setBackgroundColor('#0a0e17')
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
