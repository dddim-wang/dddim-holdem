import { useEffect, useState } from 'react'
import { useParams, Link, useLocation } from 'react-router-dom'
import { socket } from '../socket'
import Card from '../components/Card'
import HandRankings from '../components/HandRankings'
import { api, setAuth } from '../api'

export default function PlayerView() {
  const { gameId } = useParams()
  const location = useLocation()
  const [game, setGame] = useState(null)
  
  // Use logged-in username if available, otherwise generate random name
  const loggedInUsername = localStorage.getItem('username')
  const [name, setName] = useState(() => loggedInUsername || `P-${Math.random().toString(36).slice(2, 6)}`)
  const [hole, setHole] = useState([])
  const [hidden, setHidden] = useState(false)
  const [flipped, setFlipped] = useState(false)
  const [acted, setActed] = useState(false)
  const [showRanks, setShowRanks] = useState(false)
  const [result, setResult] = useState(null)
  const [comment, setComment] = useState('')
  const [sending, setSending] = useState(false)
  const [showQuitConfirm, setShowQuitConfirm] = useState(false)

  // Ensure API has auth header if user previously logged in
  useEffect(() => {
    const t = localStorage.getItem('token')
    if (t) setAuth(t)
  }, [])

  // Update player name when user logs in
  useEffect(() => {
    const currentUsername = localStorage.getItem('username')
    if (currentUsername && currentUsername !== name) {
      setName(currentUsername)
    }
  }, [name])

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
       console.log('DEBUG: Showdown received:', w)
       console.log('DEBUG: My name:', name)
       console.log('DEBUG: Winners:', w.winners)
       console.log('DEBUG: Winners type:', typeof w.winners)
       console.log('DEBUG: Winners includes check:', w.winners.includes(name))
       console.log('DEBUG: My name type:', typeof name)
       console.log('DEBUG: Winner names types:', w.winners.map(w => typeof w))
       setResult(w)
       const amWinner = w.winners.includes(name)
       console.log('DEBUG: Am I a winner?', amWinner)
       if (!amWinner) {
         const me = game?.players?.find((p) => p.name === name)
         if (me) {
           console.log('DEBUG: Setting lostRaises to:', me.pot)
           setResult((prev) => ({ ...prev, lostRaises: me.pot }))
         }
       } else {
         // Clear any lostRaises for winners
         console.log('DEBUG: Clearing lostRaises for winner')
         setResult((prev) => ({ ...prev, lostRaises: undefined }))
       }
       // Find this player's hand name from the show data
       const myShowData = w.show?.find(s => s.name === name)
       if (myShowData) {
         console.log('DEBUG: My hand data:', myShowData)
         setResult((prev) => ({ ...prev, myHandName: myShowData.hand_name }))
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

  const handleQuit = () => {
    setShowQuitConfirm(true)
  }

  const confirmQuit = () => {
    act('fold')
    setShowQuitConfirm(false)
  }

  const cancelQuit = () => {
    setShowQuitConfirm(false)
  }

  // Get current player info
  const currentPlayer = game?.players?.find((p) => p.name === name)
  const needsToCall = currentPlayer?.needsToCall
  const callAmount = needsToCall ? (game?.currentBet || 0) - (currentPlayer?.pot || 0) : 0
  
  // Determine if bet4 is allowed (not allowed if current bet is 8 or if someone already raised)
  const canBet4 = !needsToCall && (game?.currentBet || 0) < 8 && !game?.raiseMade
  
  // Determine if bet8 is allowed (not allowed if someone already raised)
  const canBet8 = !needsToCall && !game?.raiseMade

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
    return (
      <div className="min-h-screen bg-overlay flex items-center justify-center">
        <div className="text-center">
          <div className="spinner mx-auto mb-4"></div>
          <div className="text-2xl font-bold neon-text text-readable-dark">🎮 Joining Game... 🎮</div>
        </div>
      </div>
    )

  const isAuthed = Boolean(localStorage.getItem('token'))
  const username = localStorage.getItem('username') || 'Player'

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('username')
    window.location.reload()
  }

  return (
    <div className="min-h-screen bg-overlay text-white p-6 space-y-4">
      {/* Header with Login/Register only on player side */}
      <div className="flex items-center justify-between slide-in">
                 <h1 className="text-2xl font-bold neon-text text-readable-dark">🎰 Game {game.gameId} 🎰</h1>
        <div className="flex items-center gap-3">
          {!isAuthed ? (
            <>
              <Link to={`/login?returnTo=${encodeURIComponent(location.pathname)}`} className="flashy-button hover-lift">
                🔐 Login
              </Link>
              <Link to={`/register?returnTo=${encodeURIComponent(location.pathname)}`} className="flashy-button hover-lift">
                ✨ Register
              </Link>
            </>
          ) : (
            <>
              <span className="text-white shimmer-text text-lg text-readable">👋 Hi, {username}</span>
              <button onClick={handleLogout} className="flashy-button hover-lift">
                🚪 Logout
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flashy-card glass-enhanced p-6 fade-in-up">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-readable">
            <span className="text-2xl">👤</span>
            <span className="text-lg">Your name: <span className="font-bold neon-text">{name}</span></span>
          </div>
          <div className="flex items-center gap-2 text-readable">
            <span className="text-2xl">🎯</span>
            <span className="text-lg">Stage: <span className="font-bold shimmer-text">{game.stage}</span></span>
          </div>
          
          <div className="flex items-center gap-2 text-readable">
            <span className="text-2xl">💰</span>
            <span className="text-lg">Current bet: <span className="font-bold text-green-400">{game.currentBet || 0}</span></span>
          </div>
                     <div className="flex items-center gap-2 text-readable">
             <span className="text-2xl">💪</span>
             <span className="text-lg">Squats you must complete: <span className="font-bold text-yellow-400">
               {game.players?.filter(p => !p.name.startsWith('Host-')).map(p => (
                 <div key={p.name} className="inline-block mr-2 bounce-element">
                   {p.name}: {p.pot || 0}
                 </div>
               ))}
             </span></span>
           </div>
        </div>
        {needsToCall && (
          <div className="mt-4 glow-button p-4 text-center">
            <div className="font-bold text-xl text-readable">🎰 You must call or fold! 🎰</div>
            <div className="text-lg text-readable">Call amount: <span className="font-bold text-yellow-300">{callAmount}</span></div>
          </div>
        )}
      </div>

             <div className="flashy-card glass-enhanced p-6 flex items-center gap-4 floating-element">
         <Card code={hole[0]} hidden={hidden} flipped={flipped} onToggle={() => setHidden(!hidden)} size="xlarge" />
         <Card code={hole[1]} hidden={hidden} flipped={flipped} onToggle={() => setHidden(!hidden)} size="xlarge" />
         <button onClick={() => setShowRanks(true)} className="ml-auto flashy-button hover-lift">
           📊 Hand rankings
         </button>
       </div>

       {/* Folded State Indicator */}
       {currentPlayer && !currentPlayer.inHand && (
         <div className="flashy-card glass-enhanced p-6 text-center error-shake">
           <div className="text-3xl mb-2">🔴</div>
           <div className="text-2xl font-bold text-readable-dark neon-text mb-2">You Folded!</div>
           <div className="text-lg text-readable">
             You are no longer in this round. You must complete <span className="font-bold text-yellow-400">{currentPlayer.pot}</span> squats.
           </div>
           <div className="mt-4 text-sm text-readable opacity-75">
             Wait for the round to end to see the results.
           </div>
         </div>
       )}

             {!result && (
         <div className="flashy-card glass-enhanced p-6 flex gap-4 flex-wrap">
           {currentPlayer && !currentPlayer.inHand ? (
             <div className="w-full text-center">
               <div className="text-lg text-readable opacity-75">
                 🔴 You folded and cannot take any more actions this round.
               </div>
             </div>
           ) : (
             <>
               <button 
                 onClick={() => act('check')} 
                 disabled={acted || needsToCall} 
                 className={`flashy-button hover-lift ${needsToCall ? 'opacity-50' : ''}`}
               >
                 ✅ Check
               </button>
          {needsToCall && (
            <>
                             <button 
                 onClick={() => act('call')} 
                 disabled={acted} 
                 className="glow-button hover-lift"
               >
                 💰 Call {callAmount} More Squats
               </button>
              {!game?.raiseMade && (
                                 <button 
                   onClick={() => act('bet8')} 
                   disabled={acted} 
                   className="fire-button hover-lift"
                 >
                   <span className="fire-text">🔥⬆️ Raise to 8 More Squats🔥</span>
                 </button>
              )}
            </>
          )}
          {!needsToCall && (
            <>
                             {canBet4 && (
                 <button onClick={() => act('bet4')} disabled={acted} className="flashy-button hover-lift">
                   💎 Bet 4 More Squats
                 </button>
               )}
                             {canBet8 && (
                 <button onClick={() => act('bet8')} disabled={acted} className="fire-button hover-lift">
                   <span className="fire-text">🔥💎💎 Bet 8 More Squats🔥</span>
                 </button>
               )}
            </>
          )}
                                <button onClick={handleQuit} disabled={acted} className="ml-auto flashy-button hover-lift">
             🃏 I Quit
           </button>
             </>
           )}
         </div>
       )}

      {result && (
        <div className="flashy-card glass-enhanced p-6 text-center">
          {result.winners.includes(name) ? (
                         <div className="text-3xl font-bold success-glow bounce-element text-readable">
               🎰🎊 Congratulations on winning! 🎊🎰
             </div>
          ) : (
                         <div className="text-2xl font-bold error-shake text-readable">
               🎰 Hand over. You must do <span className="neon-text text-yellow-400">{result.lostRaises ?? 0}</span> squats! 🎰
             </div>
          )}
                     <div className="mt-4 text-lg shimmer-text text-readable">
             🏆 Your hand: <span className="font-bold text-yellow-300">{result.myHandName || result.hand_name}</span>
           </div>
        </div>
      )}

      {/* Comment box visible only when logged in */}
      {isAuthed && (
        <div className="flashy-card glass-enhanced p-6 space-y-4">
          <div className="text-lg shimmer-text text-readable">💬 Leave a comment (scrolls on host screen):</div>
          <form onSubmit={submitComment} className="flex gap-3">
            <input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Type your message…"
              className="flex-1 flashy-input"
            />
            <button
              type="submit"
              disabled={sending}
              className="flashy-button hover-lift"
            >
              {sending ? '🔄 Sending…' : '📤 Send'}
            </button>
          </form>
        </div>
      )}

             {showRanks && <HandRankings onClose={() => setShowRanks(false)} />}
       
       {/* Quit Confirmation Modal */}
       {showQuitConfirm && (
         <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
           <div className="flashy-card glass-enhanced p-8 max-w-md text-center">
             <h3 className="text-2xl font-bold mb-4 text-readable-dark neon-text">⚠️ Are you sure? ⚠️</h3>
             <p className="text-lg mb-6 text-readable">
               If you quit now, you must complete <span className="font-bold text-yellow-400">{currentPlayer?.pot || 0}</span> squats!
             </p>
             <div className="flex gap-4 justify-center">
               <button 
                 onClick={cancelQuit} 
                 className="flashy-button hover-lift"
               >
                 🚫 Cancel
               </button>
               <button 
                 onClick={confirmQuit} 
                 className="flashy-button hover-lift error-shake"
               >
                 💀 Yes, I Quit
               </button>
             </div>
           </div>
         </div>
       )}
     </div>
   )
 }
