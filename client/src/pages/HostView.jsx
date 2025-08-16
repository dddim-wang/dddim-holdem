import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import QRCode from 'react-qr-code'
import { socket } from '../socket'
import CommentTicker from '../components/CommentTicker'
import HandRankings from '../components/HandRankings'
import Card from '../components/Card'

export default function HostView(){
  const { gameId: routeGameId } = useParams()
  const [game, setGame] = useState(null)
  const [comments, setComments] = useState([])
  const [showRanks, setShowRanks] = useState(false)
  const [showQRFullscreen, setShowQRFullscreen] = useState(false)
  const nav = useNavigate()

  const gameId = routeGameId
  const joinUrl = useMemo(()=> `${window.location.origin}/play/${gameId}`, [gameId])

  useEffect(()=>{
    if (!gameId) return nav('/')
    socket.emit('join_game', { gameId, name: `Host-${Math.random().toString(36).slice(2,6)}` })
    socket.emit('request_state', { gameId })
  },[gameId])

  useEffect(()=>{
    const onState = (s)=> setGame(s)
    const onRoundSet = ()=> {/* could blink */}
    const onComment = (c)=> setComments(prev=> [c, ...prev].slice(0,50))

    socket.on('state', onState)
    socket.on('round_settled', onRoundSet)
    socket.on('new_comment', onComment)
    return ()=>{
      socket.off('state', onState)
      socket.off('round_settled', onRoundSet)
      socket.off('new_comment', onComment)
    }
  },[])

  const start = ()=> socket.emit('host_start', { gameId })
  const dealNext = ()=> socket.emit('host_deal_next', { gameId })
  const reset = ()=> socket.emit('host_reset_round', { gameId })

  if (!game) return (
    <div className="min-h-screen bg-overlay flex items-center justify-center">
      <div className="text-center">
        <div className="spinner mx-auto mb-4"></div>
        <div className="text-2xl font-bold neon-text text-readable-dark">🎮 Loading Game... 🎮</div>
      </div>
    </div>
  )

  // const canDeal = game.players?.every(p=> p.acted || !p.inHand)
  const canDeal = game.players
  ?.filter(p => p.inHand && !p.name.startsWith('Host-'))
  .every(p => p.acted) ?? false;

  return (
    <div className="min-h-screen bg-overlay text-white p-6 space-y-6">
      <div className="flex items-center justify-between slide-in">
                 <h1 className="text-3xl font-bold neon-text text-readable-dark">🎰 Host — Game {game.gameId} 🎰</h1>
        <Link to="/" className="flashy-button hover-lift">🏠 Home</Link>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="flashy-card glass-enhanced p-6 fade-in-up">
            <div className="flex items-center gap-6">
              <div className="floating-element cursor-pointer hover-lift" onClick={() => setShowQRFullscreen(true)}>
                <QRCode value={joinUrl} size={240} />
              </div>
              <div>
                <div className="text-lg shimmer-text mb-2 text-readable">🎰 Scan to join:</div>
                <div className="font-mono text-yellow-300 bg-black/20 p-2 rounded-lg">{joinUrl}</div>
                <div className="mt-3 text-3xl text-readable">👥 Players: <span className="font-bold neon-text">{game.players?.filter(p => !p.name.startsWith('Host-')).length || 0}/{game.max}</span></div>
              </div>
            </div>
          </div>

          <div className="flashy-card glass-enhanced p-6 fade-in-up">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-readable">
                <span className="text-2xl">🎯</span>
                <span>Stage: <span className="font-bold shimmer-text">{game.stage}</span></span>
              </div>
              <div className="flex items-center gap-2 text-readable">
                <span className="text-2xl">📈</span>
                <span>Raise status: {game.someoneRaised ? <span className="text-emerald-400 font-bold">🎰 Someone raised</span> : <span className="text-slate-300">🎲 No one has raised yet</span>}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-4 flex-wrap">
                         <button onClick={start} className="flashy-button hover-lift">🎰 Start Round</button>
            <button onClick={dealNext} disabled={!canDeal} className={`flashy-button hover-lift ${!canDeal ? 'opacity-50' : ''}`}>🃏 Deal next card</button>
            <button onClick={reset} className="flashy-button hover-lift">🔄 Play another round</button>
            <button onClick={()=> setShowRanks(true)} className="flashy-button hover-lift">📊 Hand rankings</button>
          </div>

          <div className="flashy-card glass-enhanced p-6 fade-in-up">
            <div className="text-lg shimmer-text mb-4 text-readable">👥 Players</div>
            <ul className="space-y-3">
              {(game.players||[]).filter(p => !p.name.startsWith('Host-')).map((p,i)=> (
                <li key={i} className="flex justify-between items-center p-3 bg-black/20 rounded-lg hover-lift text-readable">
                  <span className="font-bold neon-text">{p.name}</span>
                  <span className="text-slate-200">
                    {p.inHand? '🟢 in' : '🔴 folded'} · 💰 {p.pot} · {p.acted? '✅ acted':'⏳ waiting'}
                    {p.needsToCall && <span className="text-orange-400 font-bold"> ⚠️ MUST CALL</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Comments moved to left side */}
          <div className="flashy-card glass-enhanced p-6 fade-in-up">
            <div className="text-xl shimmer-text mb-4 text-readable">💬 Comments</div>
            <CommentTicker comments={comments} />
          </div>
        </div>

        {/* Board Cards take entire right side */}
        <div className="flashy-card glass-enhanced p-6 fade-in-up h-full flex flex-col">
          <div className="text-2xl shimmer-text mb-6 text-readable text-center">🃏 Board Cards</div>
          <div className="flex-1 flex items-center justify-center">
            <div className="flex items-center gap-6 justify-center flex-wrap">
              {(game.board || []).map((card, index) => (
                <Card 
                  key={index} 
                  code={card} 
                  hidden={false} 
                  flipped={false} 
                  onToggle={() => {}} 
                  size="xlarge"
                />
              ))}
              {(!game.board || game.board.length === 0) && (
                <div className="text-readable text-center text-gray-400 text-xl">
                  No cards revealed yet
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showRanks && <HandRankings onClose={()=> setShowRanks(false)} />}
      
      {/* Fullscreen QR Code Modal */}
      {showQRFullscreen && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50" onClick={() => setShowQRFullscreen(false)}>
          <div className="text-center">
            <div className="mb-4">
              <QRCode value={joinUrl} size={400} />
            </div>
            <div className="text-2xl font-bold text-readable-dark neon-text mb-2">🎰 Scan to Join Game!</div>
            <div className="text-lg text-readable mb-4">
              Game ID: <span className="font-mono text-yellow-300">{game.gameId}</span>
            </div>
            <div className="text-sm text-readable opacity-75">
              Click anywhere to close
            </div>
          </div>
        </div>
      )}
    </div>
  )
}