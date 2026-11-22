export type NodeBox = { x: number; y: number; width: number; height: number }

export function blockPosition(group: SVGGElement): NodeBox {
  const values = group.getAttribute('transform')?.match(/-?[\d.]+/g)?.map(Number) ?? [0, 0]
  const shape = [...group.children].find((child): child is SVGRectElement => child.tagName.toLowerCase() === 'rect')
  if (shape) return { x: values[0], y: values[1], width: Number(shape.getAttribute('width')) || 0, height: Number(shape.getAttribute('height')) || 0 }
  return { x: values[0], y: values[1], width: 0, height: 0 }
}

export function moveBlock(group: SVGGElement, delta: number) {
  const box = blockPosition(group)
  group.setAttribute('transform', `translate(${box.x + delta}, ${box.y})`)
}
