export default function Card({ code, hidden=false, flipped=false, onToggle, size="large" }){
  // Size configurations
  const sizeConfig = {
    small: { width: "w-12", height: "h-16", textSize: "text-sm", rankSize: "text-lg", suitSize: "text-xl" },
    medium: { width: "w-16", height: "h-20", textSize: "text-xs", rankSize: "text-xl", suitSize: "text-2xl" },
    large: { width: "w-24", height: "h-32", textSize: "text-sm", rankSize: "text-3xl", suitSize: "text-4xl" },
    xlarge: { width: "w-32", height: "h-40", textSize: "text-base", rankSize: "text-4xl", suitSize: "text-5xl" }
  }
  
  const config = sizeConfig[size]
  
  const back = (
    <div className={`${config.width} ${config.height} rounded-xl bg-gradient-to-br from-red-800 to-red-600 flex items-center justify-center ${config.textSize} text-white font-bold shadow-lg hover-lift cursor-pointer border-2 border-yellow-400`}>
      <div className="text-center">
        <div className="text-lg">🎰</div>
        <div className={config.textSize}>Hidden</div>
      </div>
    </div>
  )
  if (!code) return back
  const rank = code[0]
  const suit = code[1]
  const color = (suit==='H' || suit==='D') ? 'text-red-600' : 'text-black'
  const suitSymbol = suit === 'H' ? '♥' : suit === 'D' ? '♦' : suit === 'C' ? '♣' : '♠'
  
  // Convert T to 10 for display
  const displayRank = rank === 'T' ? '10' : rank
  
  const face = (
    <div className={`${config.width} ${config.height} rounded-xl bg-gradient-to-br from-white to-gray-100 flex flex-col items-center justify-center border-2 border-yellow-400 shadow-lg hover-lift cursor-pointer ${color} font-bold`}>
      <div className={`${config.rankSize} font-bold`}>{displayRank}</div>
      <div className={config.suitSize}>{suitSymbol}</div>
    </div>
  )
  const show = hidden ? back : (flipped ? back : face)
  return (
    <div onClick={onToggle} className="cursor-pointer select-none floating-element">
      {show}
    </div>
  )
}