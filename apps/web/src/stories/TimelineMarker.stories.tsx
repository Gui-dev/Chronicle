import type { Meta, StoryObj } from '@storybook/react'
import { TimelineMarker } from '../components/timeline-marker'

const meta = {
  title: 'Components/TimelineMarker',
  component: TimelineMarker,
  tags: ['autodocs'],
  argTypes: {
    date: { control: 'date' },
    isLast: { control: 'boolean' },
  },
} satisfies Meta<typeof TimelineMarker>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: { date: '2026-09-15' },
}

export const IsLast: Story = {
  args: { date: '2026-09-15', isLast: true },
}

export const NotLast: Story = {
  args: { date: '2026-09-15', isLast: false },
}

export const DifferentDates: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <TimelineMarker date="2025-01-15" />
      <TimelineMarker date="2025-06-20" />
      <TimelineMarker date="2025-12-31" isLast />
    </div>
  ),
}
