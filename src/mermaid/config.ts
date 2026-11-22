import mermaid from 'mermaid'
import elkLayouts from '@mermaid-js/layout-elk'

type AmdWindow = Window & typeof globalThis & { define?: unknown }

async function withoutAmdDefine<T>(load: () => Promise<T>) {
  const browserWindow = window as AmdWindow
  const amdDefine = browserWindow.define
  try {
    browserWindow.define = undefined
    return await load()
  } finally {
    browserWindow.define = amdDefine
  }
}

// ELK ships as a UMD bundle. Monaco's CDN loader publishes a global AMD
// `define`, which makes ELK register an anonymous AMD module in Monaco's
// loader. Hide that global both while ELK is loaded and while the algorithm
// performs lazy imports.
const elkLayoutsWithoutAmdConflict = elkLayouts.map((layout) => ({
  ...layout,
  loader: async () => {
    const algorithm = await withoutAmdDefine(() => layout.loader())
    return {
      ...algorithm,
      render: async (...args: Parameters<typeof algorithm.render>) => {
        return withoutAmdDefine(() => algorithm.render(...args))
      },
    }
  },
}))

mermaid.registerLayoutLoaders(elkLayoutsWithoutAmdConflict)

export type MermaidTheme = 'dark' | 'default' | 'forest' | 'neutral'

const documentThemeCss = `
  .node rect, .node polygon, .node path { rx: 20px; ry: 20px; }
  .cluster rect { fill: #f6f6f6 !important; stroke: #dedede !important; stroke-width: 1px !important; }
  .cluster-label text { fill: #242424 !important; font-weight: 500; }
  .nodeLabel { font-weight: 600; }
  .edgePath .path { stroke: #9a9a9a; stroke-width: 1.5px; stroke-linecap: round; stroke-linejoin: round; }
  .arrowheadPath { fill: #9a9a9a; stroke: #9a9a9a; }
  .edgeLabel rect { fill: #ffffff; stroke: #d4e1ee; stroke-width: 1px; rx: 14px; ry: 14px; }
  .edgeLabel text { fill: #1765aa; font-weight: 700; }
`

export function configureMermaid(theme: MermaidTheme) {
  mermaid.initialize({
    startOnLoad: false,
    theme,
    securityLevel: 'strict',
    fontFamily: 'Arial, Helvetica, sans-serif',
    themeCSS: theme === 'dark' ? undefined : documentThemeCss,
    themeVariables: theme === 'dark' ? undefined : {
      background: '#ffffff', clusterBkg: '#f6f6f6', clusterBorder: '#dedede', edgeLabelBackground: '#ffffff', lineColor: '#9a9a9a',
    },
    htmlLabels: false,
    layout: 'elk',
    elk: {
      // Keep every relation visually distinct; the layered algorithm then
      // minimises crossings instead of coalescing unrelated routes.
      mergeEdges: false,
      nodePlacementStrategy: 'NETWORK_SIMPLEX',
      nodePlacementAlignment: 'BALANCED',
      considerModelOrder: 'NONE',
    },
    flowchart: { defaultRenderer: 'elk', curve: 'rounded', nodeSpacing: 60, rankSpacing: 80, padding: 20, wrappingWidth: 300 },
  })
}

export async function renderMermaid(id: string, source: string, theme: MermaidTheme) {
  configureMermaid(theme)
  return mermaid.render(id, source)
}
