export function Sparkline({ data, direction }: { data: number[]; direction: 'up' | 'down' | 'flat' }) {
  const w = 64
  const h = 22
  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const range = max - min || 1
  const step = w / Math.max(data.length - 1, 1)

  const points = data.map((v, i) => {
    const x = i * step
    const y = h - ((v - min) / range) * (h - 4) - 2
    return `${x},${y}`
  })

  const color = direction === 'up' ? 'stroke-good' : direction === 'down' ? 'stroke-critical' : 'stroke-muted-foreground'

  const last = data[data.length - 1] ?? 0
  const lastY = h - ((last - min) / range) * (h - 4) - 2

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <polyline points={points.join(' ')} fill="none" className={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={(data.length - 1) * step} cy={lastY} r={2} className={direction === 'up' ? 'fill-good' : direction === 'down' ? 'fill-critical' : 'fill-muted-foreground'} />
    </svg>
  )
}
