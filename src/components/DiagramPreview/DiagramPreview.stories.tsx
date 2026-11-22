import type { Meta, StoryObj } from '@storybook/react-vite'
import { DiagramPreview } from './DiagramPreview'

const fixtures = import.meta.glob('../../../tests/fixtures/flowchart/*.mmd', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>

const entries = Object.entries(fixtures)
  .map(([path, source]) => ({ name: path.split('/').pop() ?? path, source }))
  .sort((left, right) => left.name.localeCompare(right.name))

const meta = {
  title: 'Fixtures/Flowcharts',
  component: DiagramPreview,
  parameters: {
    controls: { exclude: ['source'] },
    creevey: {
      delay: 1000, // Wait 1000ms after switching to the story
    },
  },
} satisfies Meta<typeof DiagramPreview>

export default meta
type Story = StoryObj<typeof meta>

export const TestFlowchart1: Story = { args: { title: 'test_flowchart1.mmd', source: entries.find((entry) => entry.name === 'test_flowchart1.mmd')?.source ?? '' } }
export const TestFlowchart2: Story = { args: { title: 'test_flowchart2.mmd', source: entries.find((entry) => entry.name === 'test_flowchart2.mmd')?.source ?? '' } }
export const TestFlowchart3: Story = { args: { title: 'test_flowchart3.mmd', source: entries.find((entry) => entry.name === 'test_flowchart3.mmd')?.source ?? '' } }
export const TestFlowchart4: Story = { args: { title: 'test_flowchart4.mmd', source: entries.find((entry) => entry.name === 'test_flowchart4.mmd')?.source ?? '' } }
