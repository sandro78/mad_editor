import type { NodeBox } from './blocks'

export function isCylinder(group: SVGGElement) {
  const elements = [...group.children]
  return !elements.some((child) => child.tagName.toLowerCase() === 'rect')
    && elements.some((child) => child.tagName.toLowerCase() === 'path')
}

export function cylinderSize(group: SVGGElement): Pick<NodeBox, 'width' | 'height'> {
  const transform = group.querySelector<SVGPathElement>('path')?.getAttribute('transform')
  const offset = transform?.match(/-?[\d.]+/g)?.map(Number) ?? [0, 0]
  return { width: Math.abs(offset[0]) * 2, height: Math.abs(offset[1]) * 2 }
}
