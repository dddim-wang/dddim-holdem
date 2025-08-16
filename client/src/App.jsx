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
    <div className="min-h-screen flex items-center justify-center bg-overlay text-white p-6">
      <div className="max-w-2xl w-full space-y-8">
        <div className="text-center fade-in-up">
          <h1 className="text-6xl font-bold neon-text text-readable-dark mb-4">🎰 Hold'em Squat 🎰</h1>
          <div className="text-2xl shimmer-text text-readable mb-8">The Ultimate Poker Fitness Game!</div>
        </div>
        
        <div className="flashy-card glass-enhanced p-8 text-center fade-in-up">
          <div className="space-y-6">
            <div className="text-xl space-y-3">
                             <p className="flex items-center justify-center gap-2 text-readable">
                 <span className="text-2xl">🎰</span>
                 <span>Host a room, show the QR, and let up to 15 players join!</span>
               </p>
              <p className="flex items-center justify-center gap-2 text-readable">
                <span className="text-2xl">🎯</span>
                <span>Betting is simultaneous with fixed options: check / 4 / 8 / fold</span>
              </p>
              <p className="flex items-center justify-center gap-2 text-readable">
                <span className="text-2xl">🃏</span>
                <span>First flop shows 2 cards for an extra betting round</span>
              </p>
              <p className="flex items-center justify-center gap-2 text-readable">
                <span className="text-2xl">💪</span>
                <span>Losers do squats equal to their total bets!</span>
              </p>
            </div>
            
            <div className="flex justify-center">
                             <button
                 onClick={create}
                 disabled={creating}
                 className="flashy-button hover-lift text-xl px-8 py-4"
               >
                 {creating ? '🔄 Creating…' : '🎰 Create Game (Host)'}
               </button>
            </div>
          </div>
        </div>
        
                 <div className="text-center text-lg shimmer-text text-readable">
           <p>🎰 Ready to play the most exciting poker game ever? 🎰</p>
         </div>
      </div>
    </div>
  )
}
