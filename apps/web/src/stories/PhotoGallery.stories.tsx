import type { Meta, StoryObj } from '@storybook/react'
import { PhotoGallery } from '../components/photo-gallery'

const mockPhotos = [
  {
    id: '1',
    url: 'https://picsum.photos/400/300?random=1',
    filename: 'praia.jpg',
    mimetype: 'image/jpeg',
    size: 1024,
    orderIndex: 0,
  },
  {
    id: '2',
    url: 'https://picsum.photos/400/300?random=2',
    filename: 'montanha.jpg',
    mimetype: 'image/jpeg',
    size: 1024,
    orderIndex: 1,
  },
  {
    id: '3',
    url: 'https://picsum.photos/400/300?random=3',
    filename: 'pôr-do-sol.jpg',
    mimetype: 'image/jpeg',
    size: 1024,
    orderIndex: 2,
  },
]

const manyPhotos = Array.from({ length: 8 }, (_, i) => ({
  id: String(i + 1),
  url: `https://picsum.photos/400/300?random=${i + 10}`,
  filename: `foto-${i + 1}.jpg`,
  mimetype: 'image/jpeg',
  size: 1024,
  orderIndex: i,
}))

const meta = {
  title: 'Components/PhotoGallery',
  component: PhotoGallery,
  tags: ['autodocs'],
  argTypes: {
    photos: { control: 'object' },
  },
} satisfies Meta<typeof PhotoGallery>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: { photos: mockPhotos },
}

export const SinglePhoto: Story = {
  args: { photos: [mockPhotos[0]] },
}

export const Empty: Story = {
  args: { photos: [] },
}

export const ManyPhotos: Story = {
  args: { photos: manyPhotos },
}
