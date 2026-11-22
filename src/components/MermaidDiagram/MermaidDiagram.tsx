import { useEffect, useRef, useState } from 'react'
import { renderMermaid, type MermaidTheme } from '../../mermaid/config'

type MermaidDiagramProps = {
  source: string
  theme: MermaidTheme
  className?: string
  onSvgChange?: (svg: string) => void
  zoom?: number
}

type DiagramSize = { width: number; height: number }

export function MermaidDiagram({ source, theme, className, onSvgChange, zoom = 1 }: MermaidDiagramProps) {
  const [svg, setSvg] = useState('')
  const [error, setError] = useState('')
  const [isRendering, setIsRendering] = useState(true)
  const [size, setSize] = useState<DiagramSize>()
  const containerRef = useRef<HTMLDivElement>(null)
  const renderSequence = useRef(0)

  useEffect(() => {
    const id = ++renderSequence.current
    const timeout = window.setTimeout(async () => {
      setIsRendering(true)
      try {
        const result = await renderMermaid(`mermaid-diagram-${id}`, source, theme)
        if (id !== renderSequence.current) return
        setSvg(result.svg)
        onSvgChange?.(result.svg)
        setError('')
      } catch (reason) {
        if (id !== renderSequence.current) return
        const message = reason instanceof Error ? reason.message.replace(/^Error: /, '') : 'Unable to render this diagram.'
        setError(message)
        onSvgChange?.('')
      } finally {
        if (id === renderSequence.current) setIsRendering(false)
      }
    }, 380)
    return () => window.clearTimeout(timeout)
  }, [source, theme, onSvgChange])

  useEffect(() => {
    const diagram = containerRef.current
    const canvas = diagram?.closest<HTMLElement>('[data-diagram-canvas]')
    if (!diagram || !canvas || !svg) return

    const updateSize = () => {
      const renderedSvg = diagram.querySelector<SVGSVGElement>('svg')
      if (!renderedSvg) return
      const viewBox = renderedSvg.getAttribute('viewBox')?.trim().split(/[ ,]+/).map(Number)
      const intrinsicWidth = viewBox?.[2] || Number.parseFloat(renderedSvg.getAttribute('width') || '')
      const intrinsicHeight = viewBox?.[3] || Number.parseFloat(renderedSvg.getAttribute('height') || '')
      const bounds = canvas.getBoundingClientRect()
      if (!intrinsicWidth || !intrinsicHeight || !bounds.width || !bounds.height) return

      const padding = 72
      const fitScale = Math.min(
        Math.max(0.1, (bounds.width - padding) / intrinsicWidth),
        Math.max(0.1, (bounds.height - padding) / intrinsicHeight),
      ) * zoom
      const nextSize = { width: intrinsicWidth * fitScale, height: intrinsicHeight * fitScale }
      setSize((current) => current && Math.abs(current.width - nextSize.width) < 1 && Math.abs(current.height - nextSize.height) < 1 ? current : nextSize)
    }

    const frame = window.requestAnimationFrame(updateSize)
    const observer = new ResizeObserver(updateSize)
    observer.observe(canvas)
    return () => {
      window.cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [svg, zoom])

  if (error) return <div className="error-state"><div className="error-icon">!</div><h3>Unable to render diagram</h3><p>{error}</p></div>

  return <>
    {isRendering && <div className="rendering">Updating diagram…</div>}
    <div
      ref={containerRef}
      className={className}
      style={size ? { width: `${size.width}px`, height: `${size.height}px` } : undefined}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  </>
}
