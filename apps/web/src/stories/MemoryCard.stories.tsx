import type { Meta, StoryObj } from '@storybook/react'
import { MemoryCardFull } from '../components/memory-card'

const mockMemory = {
  id: '1',
  userId: 'user-1',
  title: 'Primeiro Dia no Trabalho',
  content: 'Hoje foi o meu primeiro dia na nova empresa. Estou muito animado!',
  memoryDate: '2026-09-15T00:00:00.000Z',
  locationName: 'Escritório Central',
  locationLat: null,
  locationLng: null,
  weatherTemp: '24',
  weatherDesc: 'Ensolarado',
  weatherIcon: '☀️',
  musicTrack: 'Bohemian Rhapsody',
  musicArtist: 'Queen',
  musicUrl: null,
  musicCover: null,
  aiNarrative: null,
  createdAt: '2026-09-15T10:00:00.000Z',
  updatedAt: '2026-09-15T10:00:00.000Z',
  people: [{ id: '1', memoryId: '1', name: 'Carlos' }],
  tags: [{ id: '1', memoryId: '1', name: 'trabalho' }],
  photos: [
    {
      id: '1',
      url: 'https://picsum.photos/400/300',
      filename: 'foto1.jpg',
      mimetype: 'image/jpeg',
      size: 1024,
      orderIndex: 0,
    },
  ],
}

const mockMemoryNoWeather = {
  ...mockMemory,
  id: '2',
  title: 'Caminhada no Parque',
  content: null,
  weatherTemp: null,
  weatherDesc: null,
  weatherIcon: null,
  musicTrack: null,
  musicArtist: null,
  locationName: null,
  people: [],
  tags: [],
  photos: [],
}

const mockMemoryNoPhotos = {
  ...mockMemory,
  id: '3',
  title: 'Noite em Casa',
  photos: [],
  people: [],
  tags: [],
}

const meta = {
  title: 'Components/MemoryCard',
  component: MemoryCardFull,
  tags: ['autodocs'],
  argTypes: {
    memory: { control: 'object' },
  },
} satisfies Meta<typeof MemoryCardFull>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: { memory: mockMemory },
}

export const Compact: Story = {
  args: { memory: mockMemoryNoWeather },
}

export const NoPhotos: Story = {
  args: { memory: mockMemoryNoPhotos },
}

export const MemoryCardOnly: Story = {
  args: { memory: mockMemory },
}
