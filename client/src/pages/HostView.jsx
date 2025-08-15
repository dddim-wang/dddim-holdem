import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import QRCode from 'react-qr-code'
import { socket } from '../socket'
import CommentTicker from '../components/CommentTicker'
import HandRankings from '../components/HandRankings'

export default function HostView(){
  const { gameId: routeGameId } = useParams()
  const [game, setGame] = useState(null)
  const [comments, setComments] = useState([])
  const [showRanks, setShowRanks] = useState(false)
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

  if (!game) return <div className="p-6 text-white bg-slate-900 min-h-screen">Loading...</div>

  const canDeal = game.players?.every(p=> p.acted || !p.inHand)

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Host — Game {game.gameId}</h1>
        <Link to="/" className="text-slate-300 underline">Home</Link>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="bg-slate-800 rounded-2xl p-4">
            <div className="flex items-center gap-4">
              <QRCode value={joinUrl} size={140} />
              <div>
                <div className="text-sm text-slate-300">Scan to join:</div>
                <div className="font-mono">{joinUrl}</div>
                <div className="mt-2">Players: <span className="font-bold">{game.count}/{game.max}</span></div>
              </div>
            </div>
          </div>

          <div className="bg-slate-800 rounded-2xl p-4">
            <div>Stage: <span className="font-bold">{game.stage}</span></div>
            <div>Board: <span className="font-mono">{(game.board||[]).join(' ') || '-'}</span></div>
            <div>Pot: <span className="font-bold">{game.pot}</span></div>
            <div>Raise status: {game.someoneRaised ? <span className="text-emerald-400">Someone raised</span> : <span className="text-slate-300">No one has raised yet</span>}</div>
          </div>

          <div className="flex gap-3">
            <button onClick={start} className="px-4 py-2 bg-emerald-600 rounded-xl">Start Round</button>
            <button onClick={dealNext} disabled={!canDeal} className={`px-4 py-2 rounded-xl ${canDeal? 'bg-indigo-600':'bg-slate-700'}`}>Deal next card</button>
            <button onClick={reset} className="px-4 py-2 bg-orange-600 rounded-xl">Play another round</button>
            <button onClick={()=> setShowRanks(true)} className="px-4 py-2 bg-slate-700 rounded-xl">Hand rankings</button>
          </div>

          <div className="bg-slate-800 rounded-2xl p-4">
            <div className="text-sm mb-2 text-slate-300">Players</div>
            <ul className="space-y-1">
              {(game.players||[]).map((p,i)=> (
                <li key={i} className="flex justify-between">
                  <span>{p.name}</span>
                  <span className="text-slate-300">{p.inHand? 'in' : 'folded'} · raises {p.raises} · {p.acted? 'acted':'waiting'}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-slate-800 rounded-2xl p-4">
            <div className="text-sm text-slate-300 mb-1">Comments</div>
            <CommentTicker comments={comments} />
          </div>

          <div className="bg-slate-800 rounded-2xl p-4">
            <div className="text-sm text-slate-300 mb-2">How it works</div>
            <ol className="list-decimal list-inside space-y-1 text-slate-200">
              <li>Start round to deal 2 cards to everyone.</li>
              <li>Wait until all active players act (check/4/8/fold).</li>
              <li>Deal next card to progress: 2-card flop → 3rd flop → turn → river → showdown.</li>
              <li>After showdown, click "Play another round".</li>
            </ol>
          </div>
        </div>
      </div>

      {showRanks && <HandRankings onClose={()=> setShowRanks(false)} />}
    </div>
  )
}