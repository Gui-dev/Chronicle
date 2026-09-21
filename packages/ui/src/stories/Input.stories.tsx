import type { Meta, StoryObj } from '@storybook/react'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'

const meta = {
  title: 'UI/Input',
  component: Input,
  tags: ['autodocs'],
  argTypes: {
    type: {
      control: 'select',
      options: ['text', 'email', 'password', 'number', 'search'],
    },
  },
} satisfies Meta<typeof Input>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    placeholder: 'Digite algo...',
  },
}

export const WithLabel: Story = {
  render: () => (
    <div className="grid w-full max-w-sm items gap-1.5">
      <Label htmlFor="email">Email</Label>
      <Input type="email" id="email" placeholder="seu@email.com" />
    </div>
  ),
}

export const Password: Story = {
  args: {
    type: 'password',
    placeholder: 'Sua senha',
  },
}

export const Disabled: Story = {
  args: {
    disabled: true,
    placeholder: 'Desabilitado',
  },
}

export const File: Story = {
  args: {
    type: 'file',
  },
}
