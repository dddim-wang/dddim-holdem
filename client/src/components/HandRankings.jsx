export default function HandRankings({ onClose }){
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="flashy-card glass-enhanced p-8 max-w-4xl max-h-[90vh] overflow-y-auto">
        <h3 className="text-2xl font-bold mb-4 text-readable-dark neon-text text-center">🃏 Texas Hold'em Rankings 🃏</h3>
        <div className="flex justify-center">
          <img 
            src="/images/poker_hands.png" 
            alt="Poker Hand Rankings" 
            className="max-w-full h-auto rounded-lg shadow-lg"
          />
        </div>
        <div className="flex justify-center mt-6">
          <button onClick={onClose} className="flashy-button hover-lift">🎰 Close</button>
        </div>
      </div>
    </div>
  )
}