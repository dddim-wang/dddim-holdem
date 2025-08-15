import { useState } from 'react'
import { api, setAuth } from '../api'
import { useNavigate } from 'react-router-dom'

export default function Login(){
  const nav = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const submit = async (e)=>{
    e.preventDefault()
    try{
      const { data } = await api.post('/api/login', { username, password })
      localStorage.setItem('token', data.access_token)
      localStorage.setItem('username', data.username)
      setAuth(data.access_token)
      nav('/')
    }catch(err){ alert(err.response?.data?.error || 'Login failed') }
  }
  return (
    <div className="min-h-screen bg-slate-900 text-white p-6 flex items-center justify-center">
      <form onSubmit={submit} className="bg-slate-800 rounded-2xl p-6 w-80 space-y-3">
        <h1 className="text-xl font-bold">Login</h1>
        <input value={username} onChange={e=> setUsername(e.target.value)} placeholder="Username" className="w-full px-3 py-2 rounded bg-slate-700" />
        <input type="password" value={password} onChange={e=> setPassword(e.target.value)} placeholder="Password" className="w-full px-3 py-2 rounded bg-slate-700" />
        <button className="w-full px-4 py-2 bg-emerald-600 rounded-xl">Login</button>
      </form>
    </div>
  )
}