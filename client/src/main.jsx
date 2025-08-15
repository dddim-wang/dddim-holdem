import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './styles.css'
import App from './App'
import HostView from './pages/HostView'
import PlayerView from './pages/PlayerView'
import Login from './pages/Login'
import Register from './pages/Register'

const router = createBrowserRouter([
  { path: '/', element: <App/> },
  { path: '/host/:gameId?', element: <HostView/> },
  { path: '/play/:gameId', element: <PlayerView/> },
  { path: '/login', element: <Login/> },
  { path: '/register', element: <Register/> },
])

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
)