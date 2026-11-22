export function flowchartRelation(path: SVGPathElement) {
  return path.dataset.id?.replace(/^L_/, '').replace(/_\d+$/, '') ?? ''
}

export function edgeId(path: SVGPathElement) {
  return path.dataset.id ?? ''
}
