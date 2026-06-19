export default function LoadingSkeleton({ lines = 3, className = '' }) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="shimmer h-4 rounded-full bg-white/5" style={{ width: `${100 - i * 15}%` }} />
      ))}
    </div>
  )
}
