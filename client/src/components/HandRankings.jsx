export default function HandRankings({ onClose }){
  const items = [
    'Straight Flush', 'Four of a Kind', 'Full House', 'Flush', 'Straight', 'Three of a Kind', 'Two Pair', 'One Pair', 'High Card'
  ]
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center">
      <div className="bg-white text-slate-900 rounded-2xl p-6 w-80">
        <h3 className="text-xl font-bold mb-3">Texas Hold’em Rankings</h3>
        <ol className="list-decimal list-inside space-y-1">
          {items.map((t,i)=> <li key={i}>{t}</li>)}
        </ol>
        <button onClick={onClose} className="mt-4 px-4 py-2 bg-slate-800 text-white rounded-xl">Close</button>
      </div>
    </div>
  )
}