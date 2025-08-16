export default function CommentTicker({ comments=[] }){
  const text = comments.map(c => `${c.username}: ${c.content}`).join('   •   ')
  return (
    <div className="marquee text-lg text-slate-200 bg-black/20 p-4 rounded-lg border border-white/20">
      <span className="shimmer-text">{text || '💬 No comments yet... 💬'}</span>
    </div>
  )
}