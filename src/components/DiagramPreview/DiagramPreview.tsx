import { MermaidDiagram } from '../MermaidDiagram/MermaidDiagram'
import type { MermaidTheme } from '../../mermaid/config'

export type DiagramPreviewProps = {
  source: string
  title?: string
  theme?: MermaidTheme
}

export function DiagramPreview({ source, title, theme = 'neutral' }: DiagramPreviewProps) {
  return <section className="diagram-preview">
    {title && <h2 className="diagram-preview__title">{title}</h2>}
    <div className="diagram-preview__canvas" data-diagram-canvas><MermaidDiagram source={source} theme={theme} className="diagram-preview__svg" /></div>
  </section>
}
