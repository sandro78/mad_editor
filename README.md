# Mad Editor

Mad Editor is a browser-based editor for creating, previewing, and exporting Mermaid diagrams as PNG files.

There are many similar on market but only one from chatgpt.com generates well previews and download of high quality PNGs. This editor can be run in offline environment and allows you to get PNG previews very similar to chatgpt's ones.

It combines a Monaco-based source editor with Mermaid rendering and a layout-normalization layer that improves complex flowcharts: rounded routes, left-anchored fan-outs, distinct merge ports, and better handling of nested clusters and cylinder nodes.

## Requirements

- Node.js `20.19.6` and higher (specified in `.nvmrc`)
- npm

With NVM installed, select the project version:

```bash
nvm use
```

## Install and run locally

```bash
npm install
```

```bash
npm ci
```

```bash
npm run dev
```


Vite prints the local development URL, normally `http://localhost:5173`.

## Production build

```bash
npm run build
```

The static production bundle is written to `dist/`. You can put this static to any desired web server or open it locally in browser through file:///...

## Tests

```bash
npm test
```

The test suite discovers every `.mmd` file under `tests/fixtures/**`, renders it, and compares the final normalized SVG with its approved snapshot. Unintended changes to node placement, routes, arrow markers, or cluster handling will fail the test run. Do not forget to run tests or update snapshots from fixtures (see below) after any changes. Do not hesitate to add new fixtures which you debug against Mad Editor.

When an intentional rendering change is approved, regenerate snapshots with:

```bash
npm test -- --update
```

Review the snapshot diff before committing it.

## Visual fixture review

Storybook renders the same `MermaidDiagram` component used by the editor. It
automatically discovers the flowchart fixtures and provides an isolated visual
review for each one.

```bash
npm run storybook
```

Open the URL printed by Storybook (normally `http://localhost:6006`) and select
**Fixtures / Flowcharts**. To build the static Storybook site, run:

```bash
npm run build-storybook
```

## Control visual fixture views with screnshots testing

Useful project [Creevey](https://github.com/creevey/creevey) allows to automatically control visual degradations of diagrams preview. In order to run screenshot tests in browser UI perform:

```bash
npm run creevey-ui
```

Run screenshot tests and check results - approve changes at screenshots or fix code and run again. Do not forget to commit updated screenshots for further validation.

Also automated version available for using at CI or AI agents:

```bash
npm run creevey-ci
```
