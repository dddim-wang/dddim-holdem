export default function Card({ code, hidden=false, flipped=false, onToggle }){
  const back = (
    <div className="w-12 h-16 rounded-lg bg-slate-700 flex items-center justify-center text-xs text-white">Hidden</div>
  )
  if (!code) return back
  const rank = code[0]
  const suit = code[1]
  const color = (suit==='H' || suit==='D') ? 'text-red-600' : 'text-white'
  const face = (
    <div className={`w-12 h-16 rounded-lg bg-white flex flex-col items-center justify-center border ${color}`}>
      <div className="font-bold">{rank}</div>
      <div>{suit}</div>
    </div>
  )
  const show = hidden ? back : (flipped ? back : face)
  return (
    <div onClick={onToggle} className="cursor-pointer select-none">{show}</div>
  )
}