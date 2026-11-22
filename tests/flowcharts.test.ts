// @vitest-environment jsdom
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import mermaid from 'mermaid'
import elkLayouts from '@mermaid-js/layout-elk'

mermaid.registerLayoutLoaders(elkLayouts)

const fixturesDirectory = join(process.cwd(), 'tests/fixtures/flowchart')
const fixtureFiles = (await readdir(fixturesDirectory))
  .filter((file) => file.endsWith('.mmd'))
  .sort()

function stableSvg(svg: string) {
  return svg
    .replace(/mermaid-(?:preview|test)-\d+/g, 'mermaid-id')
    .replace(/\s+/g, ' ')
    .replace(/> </g, '><')
}

beforeAll(() => {
  Object.defineProperty(SVGElement.prototype, 'getComputedTextLength', {
    configurable: true,
    value() { return (this.textContent?.length ?? 0) * 8 },
  })
  Object.defineProperty(SVGElement.prototype, 'getBBox', {
    configurable: true,
    value() { return { x: 0, y: 0, width: (this.textContent?.length ?? 0) * 8, height: 20 } },
  })
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    htmlLabels: false,
    layout: 'elk',
    elk: {
      mergeEdges: false,
      nodePlacementStrategy: 'NETWORK_SIMPLEX',
      nodePlacementAlignment: 'BALANCED',
      considerModelOrder: 'NONE',
    },
    flowchart: { defaultRenderer: 'elk', curve: 'rounded', nodeSpacing: 60, rankSpacing: 80, padding: 20, wrappingWidth: 300 },
  })
})

describe('flowchart SVG regressions', () => {
  it.each(fixtureFiles)('matches the approved SVG for flowcharts/%s', async (fixtureFile) => {
    const source = await readFile(join(fixturesDirectory, fixtureFile), 'utf8')
    const result = await mermaid.render(`mermaid-test-${fixtureFile.replace(/\W/g, '-')}`, source)
    expect(stableSvg(result.svg)).toMatchSnapshot()
  })
})
