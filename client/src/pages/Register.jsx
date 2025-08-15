import { useState } from 'react'
import { api } from '../api'
import { useNavigate } from 'react-router-dom'

export default function Register(){
  const nav = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const submit = async (e)=>{
    e.preventDefault()
    try{
      await api.post('/api/register', { username, password })
      alert('Registered! Now login.')
      nav('/login')
    }catch(err){ alert(err.response?.data?.error || 'Register failed') }
  }
  return (
    <div className="min-h-screen bg-slate-900 text-white p-6 flex items-center justify-center">
      <form onSubmit={submit} className="bg-slate-800 rounded-2xl p-6 w-80 space-y-3">
        <h1 className="text-xl font-bold">Register</h1>
        <input value={username} onChange={e=> setUsername(e.target.value)} placeholder="Username" className="w-full px-3 py-2 rounded bg-slate-700" />
        <input type="password" value={password} onChange={e=> setPassword(e.target.value)} placeholder="Password" className="w-full px-3 py-2 rounded bg-slate-700" />
        <button className="w-full px-4 py-2 bg-indigo-600 rounded-xl">Create account</button>
      </form>
    </div>
  )
}