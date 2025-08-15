export default function CommentTicker({ comments=[] }){
  const text = comments.map(c => `${c.username}: ${c.content}`).join('   •   ')
  return (
    <div className="marquee text-sm text-slate-200">
      <span>{text || 'No comments yet...'}</span>
    </div>
  )
}