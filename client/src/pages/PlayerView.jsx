import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { socket } from '../socket'
import Card from '../components/Card'
import HandRankings from '../components/HandRankings'
import { api, setAuth } from '../api'

export default function PlayerView() {
  const { gameId } = useParams()
  const [name] = useState(() => `P-${Math.random().toString(36).slice(2, 6)}`)
  const [game, setGame] = useState(null)
  const [hole, setHole] = useState([])
  const [hidden, setHidden] = useState(false)
  const [flipped, setFlipped] = useState(false)
  const [acted, setActed] = useState(false)
  const [showRanks, setShowRanks] = useState(false)
  const [result, setResult] = useState(null)
  const [comment, setComment] = useState('')
  const [sending, setSending] = useState(false)

  // Ensure API has auth header if user previously logged in
  useEffect(() => {
    const t = localStorage.getItem('token')
    if (t) setAuth(t)
  }, [])

  // Join the game and ask for state
  useEffect(() => {
    socket.emit('join_game', { gameId, name })
    socket.emit('request_state', { gameId })
  }, [gameId, name])

  // Socket listeners
  useEffect(() => {
    const onState = (s) => {
      setGame(s)
      const me = s.players?.find((p) => p.name === name)
      setActed(Boolean(me?.acted))
    }
    const onCards = (c) => setHole(c.cards)
    const onShowdown = (w) => {
      setResult(w)
      const amWinner = w.winners.includes(name)
      if (!amWinner) {
        const me = game?.players?.find((p) => p.name === name)
        if (me) setResult((prev) => ({ ...prev, lostRaises: me.raises }))
      }
    }

    socket.on('state', onState)
    socket.on('your_cards', onCards)
    socket.on('showdown', onShowdown)
    return () => {
      socket.off('state', onState)
      socket.off('your_cards', onCards)
      socket.off('showdown', onShowdown)
    }
  }, [name, game])

  const act = (action) => {
    socket.emit('player_action', { gameId, action })
    setActed(true)
  }

  const submitComment = async (e) => {
    e.preventDefault()
    const content = comment.trim()
    if (!content) return
    try {
      setSending(true)
      await api.post('/api/comments', { game_id: game.gameId, content })
      setComment('')
      // Host will receive via socket and show on ticker
    } catch (err) {
      alert(err?.response?.data?.error || 'Failed to send comment (login required).')
    } finally {
      setSending(false)
    }
  }

  if (!game)
    return <div className="p-6 text-white bg-slate-900 min-h-screen">Joining...</div>

  const isAuthed = Boolean(localStorage.getItem('token'))
  const username = localStorage.getItem('username') || 'Player'

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6 space-y-4">
      {/* Header with Login/Register only on player side */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Game {game.gameId}</h1>
        <div className="flex items-center gap-3">
          {!isAuthed ? (
            <>
              <Link to="/login" className="px-3 py-1 bg-slate-700 rounded-xl">
                Login
              </Link>
              <Link to="/register" className="px-3 py-1 bg-slate-700 rounded-xl">
                Register
              </Link>
            </>
          ) : (
            <span className="text-slate-300">Hi, {username}</span>
          )}
          <Link to="/" className="text-slate-300 underline">
            Home
          </Link>
        </div>
      </div>

      <div className="bg-slate-800 rounded-2xl p-4">
        <div>
          Your name: <span className="font-bold">{name}</span>
        </div>
        <div>
          Stage: <span className="font-bold">{game.stage}</span>
        </div>
        <div>
          Board: <span className="font-mono">{(game.board || []).join(' ') || '-'}</span>
        </div>
        <div>
          Pot: <span className="font-bold">{game.pot}</span>
        </div>
      </div>

      <div className="bg-slate-800 rounded-2xl p-4 flex items-center gap-3">
        <Card code={hole[0]} hidden={hidden} flipped={flipped} onToggle={() => setHidden(!hidden)} />
        <Card code={hole[1]} hidden={hidden} flipped={flipped} onToggle={() => setHidden(!hidden)} />
        <button onClick={() => setFlipped((v) => !v)} className="px-3 py-2 bg-slate-700 rounded-xl">
          Flip
        </button>
        <button onClick={() => setHidden((v) => !v)} className="px-3 py-2 bg-slate-700 rounded-xl">
          Hide/Show
        </button>
        <button onClick={() => setShowRanks(true)} className="ml-auto px-3 py-2 bg-slate-700 rounded-xl">
          Hand rankings
        </button>
      </div>

      {!result && (
        <div className="bg-slate-800 rounded-2xl p-4 flex gap-3">
          <button onClick={() => act('check')} disabled={acted} className="px-4 py-3 bg-slate-700 rounded-xl">
            Check
          </button>
          <button onClick={() => act('bet4')} disabled={acted} className="px-4 py-3 bg-emerald-600 rounded-xl">
            Bet 4
          </button>
          <button onClick={() => act('bet8')} disabled={acted} className="px-4 py-3 bg-indigo-600 rounded-xl">
            Bet 8
          </button>
          <button onClick={() => act('fold')} disabled={acted} className="ml-auto px-4 py-3 bg-orange-600 rounded-xl">
            Fold
          </button>
        </div>
      )}

      {result && (
        <div className="bg-slate-800 rounded-2xl p-4">
          {result.winners.includes(name) ? (
            <div className="text-2xl font-bold text-emerald-400">Congratulations on winning!</div>
          ) : (
            <div>
              <div className="text-xl font-bold">Hand over.</div>
              <div className="text-slate-300">Your cumulative raises: {result.lostRaises ?? '-'}</div>
            </div>
          )}
          <div className="mt-3 text-slate-200">
            Winning hand: {result.hand_name} · Pot {result.pot}
          </div>
        </div>
      )}

      {/* Comment box visible only when logged in */}
      {isAuthed && (
        <div className="bg-slate-800 rounded-2xl p-4 space-y-2">
          <div className="text-sm text-slate-300">Leave a comment (scrolls on host screen):</div>
          <form onSubmit={submitComment} className="flex gap-2">
            <input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Type your message…"
              className="flex-1 px-3 py-2 rounded bg-slate-700 text-white"
            />
            <button
              type="submit"
              disabled={sending}
              className="px-4 py-2 bg-emerald-600 rounded-xl"
            >
              {sending ? 'Sending…' : 'Send'}
            </button>
          </form>
        </div>
      )}

      {showRanks && <HandRankings onClose={() => setShowRanks(false)} />}
    </div>
  )
}
