import type { Meta, StoryObj } from '@storybook/react'
import { Badge } from '../components/ui/badge'

const meta = {
  title: 'UI/Badge',
  component: Badge,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'secondary', 'destructive', 'outline'],
    },
  },
} satisfies Meta<typeof Badge>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    children: 'Badge',
  },
}

export const Secondary: Story = {
  args: {
    variant: 'secondary',
    children: 'Secondary',
  },
}

export const Destructive: Story = {
  args: {
    variant: 'destructive',
    children: 'Destructive',
  },
}

export const Outline: Story = {
  args: {
    variant: 'outline',
    children: 'Outline',
  },
}

export const Weather: Story = {
  render: () => (
    <div className="flex gap-2">
      <Badge>☀️ 24°C</Badge>
      <Badge variant="secondary">🌧️ 19°C</Badge>
      <Badge variant="outline">🌙 Noite</Badge>
    </div>
  ),
}
