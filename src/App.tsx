import { useCallback, useEffect, useMemo, useState } from 'react'
import Editor from '@monaco-editor/react'
import { download } from './lib/download'
import { type MermaidTheme } from './mermaid/config'
import { blockPosition, moveBlock } from './mermaid/elements/blocks'
import { cylinderSize, isCylinder } from './mermaid/elements/cylinders'
import { edgeId, flowchartRelation } from './mermaid/elements/arrows'
import { starterDiagram, templates } from './diagram/templates'
import { MermaidDiagram } from './components/MermaidDiagram/MermaidDiagram'
import packageJson from '../package.json'

/** Gives a multi-branch flow a document-like, left-anchored fan-out. */
export function normalizeFanOut(svg: string) {
  const markerClearance = 8
  const documentSvg = new DOMParser().parseFromString(svg, 'image/svg+xml')
  const groups = [...documentSvg.querySelectorAll<SVGGElement>('g.node')]
  const nodeByKey = new Map(groups.map((group) => [group.id.match(/-flowchart-(.+)-\d+$/)?.[1], group]))
  const nodeKeys = [...nodeByKey.keys()].filter((key): key is string => Boolean(key)).sort((a, b) => b.length - a.length)
  const position = (group: SVGGElement) => isCylinder(group)
    ? { ...blockPosition(group), ...cylinderSize(group) }
    : blockPosition(group)
  const isPathNode = isCylinder
  const edges = [...documentSvg.querySelectorAll<SVGPathElement>('path[data-id]')].map((path) => {
    const relation = flowchartRelation(path)
    const from = nodeKeys.find((key) => relation.startsWith(`${key}_`))
    const to = from ? relation.slice(from.length + 1) : undefined
    return { path, from, to }
  }).filter((edge): edge is { path: SVGPathElement; from: string; to: string } => Boolean(edge.from && edge.to && nodeByKey.has(edge.to)))
  const bySource = new Map<string, typeof edges>()
  edges.forEach((edge) => bySource.set(edge.from, [...(bySource.get(edge.from) ?? []), edge]))
  const byTarget = new Map<string, typeof edges>()
  edges.forEach((edge) => byTarget.set(edge.to, [...(byTarget.get(edge.to) ?? []), edge]))
  const rewrittenEdgeIds = new Set<string>()
  const markRewritten = (path: SVGPathElement) => rewrittenEdgeIds.add(edgeId(path))
  const fanOut = [...bySource.entries()].sort((a, b) => b[1].length - a[1].length).find(([, links]) => links.length >= 3 && links.every((link) => nodeByKey.has(link.to)))
  if (!fanOut) return svg

  const [sourceKey, links] = fanOut
  const source = nodeByKey.get(sourceKey)
  if (!source) return svg
  const sourceBox = position(source)
  const targets = links.map((link) => ({ link, group: nodeByKey.get(link.to)!, box: position(nodeByKey.get(link.to)!) })).sort((a, b) => a.box.x - b.box.x)
  if (targets.some((target) => Math.abs(target.box.y - targets[0].box.y) > 2)) return svg

  // Match Mermaid's compact document layout: anchor the source over the first branch.
  const desiredX = targets[0].box.x + sourceBox.width / 3
  const shiftX = desiredX - sourceBox.x
  const move = moveBlock
  move(source, shiftX)

  const incoming = edges.find((edge) => edge.to === sourceKey && nodeByKey.has(edge.from))
  if (incoming) {
    const parent = nodeByKey.get(incoming.from)!
    const originalParentBox = position(parent)
    const parentCluster = [...documentSvg.querySelectorAll<SVGGElement>('g.cluster')]
      .map((group) => ({ group, rect: group.querySelector<SVGRectElement>('rect') }))
      .filter((item): item is { group: SVGGElement; rect: SVGRectElement } => Boolean(item.rect))
      .filter(({ rect }) => {
        const x = Number(rect.getAttribute('x')), y = Number(rect.getAttribute('y'))
        const width = Number(rect.getAttribute('width')), height = Number(rect.getAttribute('height'))
        return x <= originalParentBox.x && x + width >= originalParentBox.x && y <= originalParentBox.y && y + height >= originalParentBox.y
      })
      .sort((a, b) => Number(a.rect.getAttribute('width')) * Number(a.rect.getAttribute('height')) - Number(b.rect.getAttribute('width')) * Number(b.rect.getAttribute('height')))[0]
    parentCluster?.group.setAttribute('transform', `translate(${shiftX}, 0)`)
    move(parent, shiftX)
    const parentBox = position(parent)
    const movedSource = position(source)
    incoming.path.setAttribute('d', `M${parentBox.x},${parentBox.y + parentBox.height / 2}L${parentBox.x},${movedSource.y - movedSource.height / 2 - markerClearance}`)
    markRewritten(incoming.path)
    const edgeLabel = documentSvg.querySelector<SVGGElement>(`.edgeLabel .label[data-id="${incoming.path.dataset.id}"]`)?.closest('g.edgeLabel')
    edgeLabel?.setAttribute('transform', `translate(${parentBox.x}, ${(parentBox.y + movedSource.y) / 2})`)
  }

  const movedSource = position(source)
  targets.forEach(({ link, box }, index) => {
    const startX = movedSource.x - movedSource.width / 3 + (index * (movedSource.width * 2 / 3)) / Math.max(1, targets.length - 1)
    const startY = movedSource.y + movedSource.height / 2
    const endY = box.y - box.height / 2 - markerClearance
    if (index === 0) {
      link.path.setAttribute('d', `M${startX},${startY}L${box.x},${endY}`)
      markRewritten(link.path)
      return
    }
    const laneY = startY + 15 + (targets.length - 1 - index) * 15
    const radius = 7
    link.path.setAttribute('d', `M${startX},${startY}L${startX},${laneY - radius}Q${startX},${laneY} ${startX + radius},${laneY}L${box.x - radius},${laneY}Q${box.x},${laneY} ${box.x},${laneY + radius}L${box.x},${endY}`)
    markRewritten(link.path)
  })

  const fanOutSources = new Set([sourceKey])
  const mergeTargets = new Set<string>()
  const mergeEdgeIds = new Set<string>()
  const shiftedNodeKeys = new Set<string>()
  const shiftedNodeDeltas = new Map<string, number>()

  const containingCluster = (box: ReturnType<typeof position>) => [...documentSvg.querySelectorAll<SVGGElement>('g.cluster')]
    .map((group) => ({ group, rect: group.querySelector<SVGRectElement>('rect') }))
    .filter((item): item is { group: SVGGElement; rect: SVGRectElement } => Boolean(item.rect))
    .filter(({ rect }) => {
      const x = Number(rect.getAttribute('x')), y = Number(rect.getAttribute('y'))
      const width = Number(rect.getAttribute('width')), height = Number(rect.getAttribute('height'))
      return x <= box.x && x + width >= box.x && y <= box.y && y + height >= box.y
    })
    .sort((a, b) => Number(a.rect.getAttribute('width')) * Number(a.rect.getAttribute('height')) - Number(b.rect.getAttribute('width')) * Number(b.rect.getAttribute('height')))[0]

  // A merge needs separate landing ports.  For wide merges (the API handler in
  // the volumes diagram) move the whole downstream section to the left first;
  // moving only the receiving node is what previously left edges hanging in air.
  ;[...byTarget.entries()].forEach(([key, incomingEdges]) => {
    if (key === sourceKey || incomingEdges.length < 2 || !nodeByKey.has(key)) return
    const target = nodeByKey.get(key)!
    // Preserve Mermaid's native routing for non-rectangular targets (such as
    // the cylinder used for VOLUMES); it will be translated as a whole below.
    if (isPathNode(target)) return
    const incomingLinks = incomingEdges
      .filter((edge) => !fanOutSources.has(edge.from) && nodeByKey.has(edge.from))
      .sort((a, b) => position(nodeByKey.get(a.from)!).x - position(nodeByKey.get(b.from)!).x)
    if (incomingLinks.length < 2) return

    mergeTargets.add(key)
    if (incomingLinks.length >= 3) {
      const beforeMove = position(target)
      const outgoingCount = new Set((bySource.get(key) ?? [])
        .filter((edge) => nodeByKey.has(edge.to))
        .map((edge) => edge.to)).size
      const hasMutualRelation = (bySource.get(key) ?? []).some((edge) =>
        (bySource.get(edge.to) ?? []).some((returnEdge) => returnEdge.to === key))
      // Put a shared resource below the centre of the operations that use it.
      // Anchoring it to the first source works for a processing node that fans
      // out again, but makes a wide row (CONFIG/JOURNAL/DATA → FS) drag a
      // terminal resource and its routes far off to the left.
      const desiredX = outgoingCount < 2 || hasMutualRelation
        ? incomingLinks.reduce((sum, edge) => sum + position(nodeByKey.get(edge.from)!).x, 0) / incomingLinks.length
        : position(nodeByKey.get(incomingLinks[0].from)!).x + beforeMove.width / 3
      const delta = desiredX - beforeMove.x
      const hasMergedDescendant = (() => {
        const queue = [key]
        const seen = new Set(queue)
        while (queue.length) {
          const current = queue.shift()!
          for (const edge of bySource.get(current) ?? []) {
            if (mergeTargets.has(edge.to)) return true
            if (!seen.has(edge.to)) {
              seen.add(edge.to)
              queue.push(edge.to)
            }
          }
        }
        return false
      })()
      if (Math.abs(delta) > 1 && !hasMergedDescendant) {
        const descendants = new Set<string>([key])
        const queue = [key]
        while (queue.length) {
          const current = queue.shift()!
          ;(bySource.get(current) ?? []).forEach((edge) => {
            if (!descendants.has(edge.to)) {
              descendants.add(edge.to)
              queue.push(edge.to)
            }
          })
        }
        const shiftedClusters = new Set<SVGGElement>()
        descendants.forEach((nodeKey) => {
          const node = nodeByKey.get(nodeKey)
          if (!node) return
          const cluster = containingCluster(position(node))
          if (cluster && !shiftedClusters.has(cluster.group)) {
            cluster.group.setAttribute('transform', `translate(${delta}, 0)`)
            shiftedClusters.add(cluster.group)
          }
          move(node, delta)
          shiftedNodeKeys.add(nodeKey)
          shiftedNodeDeltas.set(nodeKey, (shiftedNodeDeltas.get(nodeKey) ?? 0) + delta)
        })
      }
    }

    const targetBox = position(target)
    incomingLinks.forEach((edge, index) => {
      const from = position(nodeByKey.get(edge.from)!)
      const targetX = targetBox.x + (index - (incomingLinks.length - 1) / 2) * (targetBox.width / (incomingLinks.length + 1))
      const hasStartMarker = edge.path.hasAttribute('marker-start')
      const startY = from.y + from.height / 2 + (hasStartMarker ? markerClearance : 0)
      const endY = targetBox.y - targetBox.height / 2 - markerClearance
      const radius = 7
      if (Math.abs(from.x - targetX) < 2) {
        edge.path.setAttribute('d', `M${from.x},${startY}L${targetX},${endY}`)
      } else {
        const laneY = startY + 20 * Math.max(1, index)
        const direction = targetX > from.x ? 1 : -1
        edge.path.setAttribute('d', `M${from.x},${startY}L${from.x},${laneY - radius}Q${from.x},${laneY} ${from.x + direction * radius},${laneY}L${targetX - direction * radius},${laneY}Q${targetX},${laneY} ${targetX},${laneY + radius}L${targetX},${endY}`)
      }
      mergeEdgeIds.add(edgeId(edge.path))
      markRewritten(edge.path)
    })
  })

  // Apply the same routing to smaller fan-outs such as API handlers → two implementations.
  ;[...bySource.entries()].filter(([key, outgoing]) => key !== sourceKey && outgoing.length >= 2 && outgoing.every((edge) => nodeByKey.has(edge.to))).forEach(([key, outgoing]) => {
    // A bridge leading to an already positioned shared resource must retain
    // Mermaid's column. Moving it to its first child would undo that resource
    // placement (CLI → FS in the agent diagram).
    if (outgoing.some((edge) => mergeTargets.has(edge.to))) return
    const fan = nodeByKey.get(key)
    if (!fan) return
    const fanTargets = outgoing.map((link) => ({ link, box: position(nodeByKey.get(link.to)!) })).sort((a, b) => a.box.x - b.box.x)
    if (fanTargets.some((target) => Math.abs(target.box.y - fanTargets[0].box.y) > 2)) return
    const fanBox = position(fan)
    // A fan-out belongs over its first (left-most) child. This is especially
    // important for HANDLER: it is a merge for its inputs, but a left-anchored
    // source for CLI/FS beneath it.
    move(fan, fanTargets[0].box.x + fanBox.width / 3 - fanBox.x)
    const movedFan = position(fan)
    fanOutSources.add(key)
    if (mergeTargets.has(key)) {
      const inputs = [...(byTarget.get(key) ?? [])]
        .filter((edge) => nodeByKey.has(edge.from))
        .sort((a, b) => position(nodeByKey.get(a.from)!).x - position(nodeByKey.get(b.from)!).x)
      inputs.forEach((edge, index) => {
        const from = position(nodeByKey.get(edge.from)!)
        const entryX = movedFan.x + (index - (inputs.length - 1) / 2) * (movedFan.width / (inputs.length + 1))
        const startY = from.y + from.height / 2 + (edge.path.hasAttribute('marker-start') ? markerClearance : 0)
        const endY = movedFan.y - movedFan.height / 2 - markerClearance
        const radius = 7
        if (Math.abs(from.x - entryX) < 2) {
          edge.path.setAttribute('d', `M${from.x},${startY}L${entryX},${endY}`)
        } else {
          const laneY = startY + 20 * Math.max(1, index)
          const direction = entryX > from.x ? 1 : -1
          edge.path.setAttribute('d', `M${from.x},${startY}L${from.x},${laneY - radius}Q${from.x},${laneY} ${from.x + direction * radius},${laneY}L${entryX - direction * radius},${laneY}Q${entryX},${laneY} ${entryX},${laneY + radius}L${entryX},${endY}`)
        }
        markRewritten(edge.path)
      })
    }
    fanTargets.forEach(({ link, box }, index) => {
      const startX = movedFan.x - movedFan.width / 3 + (index * (movedFan.width * 2 / 3)) / Math.max(1, fanTargets.length - 1)
      const startY = movedFan.y + movedFan.height / 2
      const endY = box.y - box.height / 2 - markerClearance
      const laneY = startY + 20 + (fanTargets.length - 1 - index) * 14
      const radius = 7
      if (Math.abs(startX - box.x) < 2) {
        link.path.setAttribute('d', `M${startX},${startY}L${box.x},${endY}`)
      } else {
        link.path.setAttribute('d', `M${startX},${startY}L${startX},${laneY - radius}Q${startX},${laneY} ${startX + radius},${laneY}L${box.x - radius},${laneY}Q${box.x},${laneY} ${box.x},${laneY + radius}L${box.x},${endY}`)
      }
      markRewritten(link.path)
    })
  })

  // Normalize lower merge routes (e.g. PREP/FREE → FS) into compact, rounded elbows.
  // Cylinders normally receive links at their side tangents. For a document
  // diagram it reads much better when downward dependencies enter the top
  // ellipse, just like ordinary blocks. Give each incoming link its own port.
  ;[...byTarget.entries()].forEach(([targetKey, incomingEdges]) => {
    const target = nodeByKey.get(targetKey)
    if (!target || !isPathNode(target)) return
    const links = incomingEdges
      .filter((edge) => shiftedNodeDeltas.get(edge.from) !== undefined && shiftedNodeDeltas.get(edge.from) === shiftedNodeDeltas.get(edge.to))
      .sort((a, b) => position(nodeByKey.get(a.from)!).x - position(nodeByKey.get(b.from)!).x)
    if (!links.length) return
    const targetBox = position(target)
    links.forEach((edge, index) => {
      const from = position(nodeByKey.get(edge.from)!)
      const targetX = targetBox.x + (index - (links.length - 1) / 2) * Math.min(targetBox.width * 0.32, 38)
      const startY = from.y + from.height / 2 + (edge.path.hasAttribute('marker-start') ? markerClearance : 0)
      const endY = targetBox.y - targetBox.height / 2 - markerClearance
      const laneY = startY + 20 + index * 12
      const direction = targetX > from.x ? 1 : -1
      const radius = 7
      edge.path.removeAttribute('transform')
      edge.path.setAttribute('d', `M${from.x},${startY}L${from.x},${laneY - radius}Q${from.x},${laneY} ${from.x + direction * radius},${laneY}L${targetX - direction * radius},${laneY}Q${targetX},${laneY} ${targetX},${laneY + radius}L${targetX},${endY}`)
      markRewritten(edge.path)
    })
  })
  const lowerEdges = edges.filter((edge) => {
    if (fanOutSources.has(edge.from) || mergeEdgeIds.has(edgeId(edge.path)) || rewrittenEdgeIds.has(edgeId(edge.path)) || !nodeByKey.has(edge.from) || !nodeByKey.has(edge.to)) return false
    const from = position(nodeByKey.get(edge.from)!)
    const to = position(nodeByKey.get(edge.to)!)
    // A target with multiple incoming links must be processed even when one
    // source is vertically aligned (VCLI/MOUNT → VOLUMES).
    return to.y > from.y && (Math.abs(to.x - from.x) >= 24 || (byTarget.get(edge.to)?.length ?? 0) > 1)
  })
  const entriesByTarget = new Map<string, typeof lowerEdges>()
  lowerEdges.forEach((edge) => entriesByTarget.set(edge.to, [...(entriesByTarget.get(edge.to) ?? []), edge]))
  lowerEdges.forEach((edge) => {
    const from = position(nodeByKey.get(edge.from)!)
    const to = position(nodeByKey.get(edge.to)!)
    const siblings = [...(entriesByTarget.get(edge.to) ?? [])].sort((a, b) => position(nodeByKey.get(a.from)!).x - position(nodeByKey.get(b.from)!).x)
    const entryIndex = siblings.indexOf(edge)
    const targetX = to.x + (entryIndex - (siblings.length - 1) / 2) * Math.min(to.width * 0.28, 72)
    const startY = from.y + from.height / 2
    const endY = to.y - to.height / 2 - markerClearance
    const laneY = Math.max(startY + 24, endY - 42)
    const radius = 7
    edge.path.setAttribute('d', `M${from.x},${startY}L${from.x},${laneY - radius}Q${from.x},${laneY} ${from.x + (targetX > from.x ? radius : -radius)},${laneY}L${targetX + (targetX > from.x ? -radius : radius)},${laneY}Q${targetX},${laneY} ${targetX},${laneY + radius}L${targetX},${endY}`)
    markRewritten(edge.path)
  })

  // Edges are not children of Mermaid's cluster groups.  Every edge touching
  // a shifted descendant therefore needs new coordinates, including upward
  // dependencies between the logic and sections.
  edges.forEach((edge) => {
    if (rewrittenEdgeIds.has(edgeId(edge.path)) || (!shiftedNodeKeys.has(edge.from) && !shiftedNodeKeys.has(edge.to))) return
    const from = position(nodeByKey.get(edge.from)!)
    const to = position(nodeByKey.get(edge.to)!)
    const downward = to.y >= from.y
    const startY = from.y + (downward ? from.height / 2 : -from.height / 2) + (edge.path.hasAttribute('marker-start') ? (downward ? markerClearance : -markerClearance) : 0)
    const endY = to.y + (downward ? -to.height / 2 - markerClearance : to.height / 2 + markerClearance)
    const direction = to.x >= from.x ? 1 : -1
    const radius = 7
    if (Math.abs(to.x - from.x) < 2) {
      edge.path.setAttribute('d', `M${from.x},${startY}L${to.x},${endY}`)
    } else {
      const laneY = (startY + endY) / 2
      edge.path.setAttribute('d', `M${from.x},${startY}L${from.x},${laneY - (downward ? radius : -radius)}Q${from.x},${laneY} ${from.x + direction * radius},${laneY}L${to.x - direction * radius},${laneY}Q${to.x},${laneY} ${to.x},${laneY + (downward ? radius : -radius)}L${to.x},${endY}`)
    }
  })

  // Mermaid calculates the viewBox before this post-processing.  Once a nested
  // section is anchored left, its nodes can legitimately extend past x=0; keep
  // the complete drawing in the exported SVG rather than clipping those nodes
  // and leaving only their edge paths visible.
  const originalViewBox = documentSvg.documentElement.getAttribute('viewBox')?.split(/[ ,]+/).map(Number)
  if (originalViewBox?.length === 4) {
    const boxes = [...nodeByKey.values()].map(position)
    const minX = Math.min(originalViewBox[0], ...boxes.map((box) => box.x - box.width / 2 - 32))
    const maxX = Math.max(originalViewBox[0] + originalViewBox[2], ...boxes.map((box) => box.x + box.width / 2 + 32))
    documentSvg.documentElement.setAttribute('viewBox', `${minX} ${originalViewBox[1]} ${maxX - minX} ${originalViewBox[3]}`)
  }
  return new XMLSerializer().serializeToString(documentSvg.documentElement)
}

export default function App() {
  const [source, setSource] = useState(() => localStorage.getItem('mermaid-source') ?? starterDiagram)
  const [theme, setTheme] = useState<MermaidTheme>('neutral')
  const [zoom, setZoom] = useState(115)
  const [svg, setSvg] = useState('')
  const [exportError, setExportError] = useState('')

  useEffect(() => { localStorage.setItem('mermaid-source', source) }, [source])

  const charCount = useMemo(() => source.length.toLocaleString('en-US'), [source])
  const handleSvgChange = useCallback((nextSvg: string) => setSvg(nextSvg), [])

  const exportSource = useCallback(() => download('diagram.mmd', source, 'text/plain;charset=utf-8'), [source])
  const exportPng = useCallback(async () => {
    if (!svg) return
    setExportError('')
    try {
      const exportSvg = svg.replace(/<br(\s[^>]*)?>/gi, '<br$1 />')
      const parsedSvg = new DOMParser().parseFromString(exportSvg, 'image/svg+xml').documentElement
      const viewBox = parsedSvg.getAttribute('viewBox')?.split(/[ ,]+/).map(Number)
      const width = viewBox?.[2] || Number.parseFloat(parsedSvg.getAttribute('width') || '') || 1200
      const height = viewBox?.[3] || Number.parseFloat(parsedSvg.getAttribute('height') || '') || 800
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(width * 2)
      canvas.height = Math.round(height * 2)
      const context = canvas.getContext('2d')!
      const image = new Image()
      const imageUrl = URL.createObjectURL(new Blob([exportSvg], { type: 'image/svg+xml;charset=utf-8' }))
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve()
        image.onerror = () => reject(new Error('the browser could not open the SVG for export'))
        image.src = imageUrl
      })
      context.fillStyle = theme === 'dark' ? '#111827' : '#ffffff'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(imageUrl)
      canvas.toBlob((blob) => {
        if (blob) download('diagram.png', blob, 'image/png')
        else setExportError('Unable to create the PNG file.')
      }, 'image/png')
    } catch (reason) {
      setExportError(`Unable to export PNG: ${reason instanceof Error ? reason.message : 'unknown error'}`)
    }
  }, [svg, theme])

  return <main className="app-shell">
    <header className="topbar">
      <div className="brand"><span className="brand-mark">M</span><span>Mad Editor</span><span className="badge">v{packageJson.version}</span></div>
      <div className="top-actions">
        <button className="ghost-button" onClick={() => navigator.clipboard.writeText(source)}>Copy source</button>
        <button className="primary-button" onClick={exportPng} disabled={!svg}>Download PNG ↓</button>
      </div>
    </header>

    <section className="workspace">
      <aside className="editor-panel">
        <div className="panel-header"><div><p className="eyebrow">SOURCE</p><h1>Diagram</h1></div><span className="saved"><i />Saved</span></div>
        <div className="template-row">
          {Object.entries(templates).map(([label, value]) => <button key={label} onClick={() => setSource(value)}>{label}</button>)}
        </div>
        <div className="editor-wrap"><Editor height="100%" defaultLanguage="markdown" value={source} onChange={(value) => setSource(value ?? '')} theme="vs-dark" options={{ minimap: { enabled: false }, fontSize: 14, lineHeight: 23, padding: { top: 18 }, scrollBeyondLastLine: false, wordWrap: 'on', automaticLayout: true }} /></div>
        <footer className="editor-footer"><span>{charCount} characters</span><button onClick={exportSource}>Download .mmd</button></footer>
      </aside>

      <section className="preview-panel">
        <div className="preview-header">
          <div><p className="eyebrow">PREVIEW</p><h2>Live diagram</h2></div>
          <div className="controls">
            <select value={theme} onChange={(event) => setTheme(event.target.value as MermaidTheme)} aria-label="Diagram theme"><option value="neutral">Document</option><option value="default">Light</option><option value="forest">Forest</option><option value="dark">Dark</option></select>
            <div className="zoom"><button onClick={() => setZoom((value) => Math.max(50, value - 10))}>−</button><span>{zoom}%</span><button onClick={() => setZoom((value) => Math.min(300, value + 10))}>+</button></div>
          </div>
        </div>
        <div className="canvas" data-diagram-canvas aria-live="polite">
          <MermaidDiagram source={source} theme={theme} zoom={zoom / 100} className="diagram" onSvgChange={handleSvgChange} />
        </div>
        <div className="preview-footer"><span><b /> Auto-update enabled</span><span>{exportError || 'Mermaid 11'}</span></div>
      </section>
    </section>
  </main>
}
