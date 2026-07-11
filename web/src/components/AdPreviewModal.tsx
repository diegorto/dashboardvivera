import { useEffect, useState } from 'react'
import { X, ExternalLink } from 'lucide-react'
import { fetchAdPreview } from '@/api/client'

const FORMATS = [
  { value: 'MOBILE_FEED_STANDARD', label: 'Feed Mobile' },
  { value: 'DESKTOP_FEED_STANDARD', label: 'Feed Desktop' },
  { value: 'INSTAGRAM_STANDARD', label: 'Instagram' },
  { value: 'INSTAGRAM_STORY', label: 'Story' },
]

export function AdPreviewModal({
  adId, adName, adUrl, onClose,
}: { adId: string; adName: string; adUrl: string | null; onClose: () => void }) {
  const [format, setFormat] = useState('MOBILE_FEED_STANDARD')
  const [html, setHtml] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setHtml(null)
    fetchAdPreview(adId, format)
      .then(r => {
        if (cancelled) return
        if (r.success && r.html) setHtml(r.html)
        else setError(r.error || 'Sem prévia disponível pra esse anúncio.')
      })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Erro ao carregar prévia.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [adId, format])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-border bg-card shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{adName}</div>
            <div className="text-xs text-muted-foreground">Prévia do anúncio (gerada agora pela Meta)</div>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-muted" aria-label="Fechar">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1 border-b border-border px-4 py-2">
          {FORMATS.map(f => (
            <button
              key={f.value}
              onClick={() => setFormat(f.value)}
              className={`rounded-md px-2 py-1 text-xs font-medium ${
                format === f.value ? 'bg-accent text-white' : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              {f.label}
            </button>
          ))}
          {adUrl && (
            <a
              href={adUrl}
              target="_blank"
              rel="noreferrer"
              className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
            >
              Abrir no Facebook <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>

        <div className="flex flex-1 items-start justify-center overflow-auto bg-muted/40 p-4">
          {loading && <div className="py-16 text-sm text-muted-foreground">Gerando prévia…</div>}
          {!loading && error && (
            <div className="max-w-sm py-16 text-center text-sm text-muted-foreground">
              {error}
              {adUrl && (
                <div className="mt-3">
                  <a href={adUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                    Tentar abrir direto no Facebook
                  </a>
                </div>
              )}
            </div>
          )}
          {!loading && html && (
            // A Meta devolve um <iframe> pronto; renderiza como veio.
            <div dangerouslySetInnerHTML={{ __html: html }} />
          )}
        </div>
      </div>
    </div>
  )
}
