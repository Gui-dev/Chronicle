import type { Meta, StoryObj } from '@storybook/react'
import { AudioPlayer } from '../components/audio-player'

const meta = {
  title: 'Components/AudioPlayer',
  component: AudioPlayer,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'Player de áudio fixo no rodapé. Gerencia seu próprio estado de track.',
      },
    },
  },
} satisfies Meta<typeof AudioPlayer>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {
  args: {},
}
