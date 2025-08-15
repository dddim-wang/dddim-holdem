import { useNavigate } from 'react-router-dom'
import { socket } from './socket'
import { useEffect, useState } from 'react'

export default function App() {
  const [creating, setCreating] = useState(false)
  const nav = useNavigate()

  useEffect(() => {
    function onCreated(e) {
      nav(`/host/${e.gameId}`)
    }
    socket.on('game_created', onCreated)
    return () => socket.off('game_created', onCreated)
  }, [nav])

  const create = () => {
    setCreating(true)
    socket.emit('host_create_game', {})
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white p-6">
      <div className="max-w-xl w-full space-y-6">
        <h1 className="text-4xl font-bold">Hold’em Squat</h1>
        <p>
          Host a room, show the QR, and let up to 15 players join. Betting is
          simultaneous with fixed options: check / 4 / 8 / fold. First flop
          shows 2 cards for an extra betting round.
        </p>
        <div className="flex gap-3">
          <button
            onClick={create}
            disabled={creating}
            className="px-5 py-3 bg-emerald-600 rounded-xl shadow"
          >
            {creating ? 'Creating…' : 'Create Game (Host)'}
          </button>
        </div>
      </div>
    </div>
  )
}
