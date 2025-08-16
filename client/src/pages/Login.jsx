import { useState, useEffect } from 'react'
import { api, setAuth } from '../api'
import { useNavigate, useLocation } from 'react-router-dom'

export default function Login(){
  const nav = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  
  // Get the return URL from query params or default to home
  const returnUrl = new URLSearchParams(location.search).get('returnTo') || '/'
  
  const submit = async (e)=>{
    e.preventDefault()
    try{
      const { data } = await api.post('/api/login', { username, password })
      localStorage.setItem('token', data.access_token)
      localStorage.setItem('username', data.username)
      setAuth(data.access_token)
      nav(returnUrl)
    }catch(err){ alert(err.response?.data?.error || 'Login failed') }
  }
  return (
    <div className="min-h-screen bg-overlay text-white p-6 flex items-center justify-center">
      <div className="flashy-card glass-enhanced p-8 w-96 space-y-6 fade-in-up">
        <div className="text-center">
          <h1 className="text-3xl font-bold neon-text text-readable-dark mb-2">🔐 Login</h1>
          <p className="shimmer-text text-readable">Welcome back to Hold'em Squat!</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold mb-2 text-readable">👤 Username</label>
            <input 
              value={username} 
              onChange={e=> setUsername(e.target.value)} 
              placeholder="Enter your username" 
              className="w-full flashy-input" 
            />
          </div>
          <div>
            <label className="block text-sm font-bold mb-2 text-readable">🔒 Password</label>
            <input 
              type="password" 
              value={password} 
              onChange={e=> setPassword(e.target.value)} 
              placeholder="Enter your password" 
              className="w-full flashy-input" 
            />
          </div>
          <button className="w-full flashy-button hover-lift text-lg py-3">
            🚀 Login
          </button>
        </form>
        <div className="text-center">
          <a href={`/register?returnTo=${encodeURIComponent(returnUrl)}`} className="text-blue-300 hover:text-blue-100 underline text-readable">
            ✨ Don't have an account? Register here!
          </a>
        </div>
      </div>
    </div>
  )
}