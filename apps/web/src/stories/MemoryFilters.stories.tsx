import { memoryFiltersSchema } from '@chronicle/schemas'
import type { Meta, StoryObj } from '@storybook/react'
import { MemoryFilters } from '../components/memory-filters'

const defaultFilters = memoryFiltersSchema.parse({})

function handleFilterChange(key: string, value: unknown) {
  console.log(`Filter ${key} changed to:`, value)
}

function handleReset() {
  console.log('Filters reset')
}

const meta = {
  title: 'Components/MemoryFilters',
  component: MemoryFilters,
  tags: ['autodocs'],
  argTypes: {
    filters: { control: 'object' },
    onFilterChange: { action: 'filterChanged' },
    onReset: { action: 'resetClicked' },
  },
} satisfies Meta<typeof MemoryFilters>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    filters: defaultFilters,
    onFilterChange: handleFilterChange,
    onReset: handleReset,
  },
}

export const WithSearch: Story = {
  args: {
    filters: { ...defaultFilters, search: 'praia' },
    onFilterChange: handleFilterChange,
    onReset: handleReset,
  },
}

export const WithYearAndMonth: Story = {
  args: {
    filters: { ...defaultFilters, year: 2026, month: 9 },
    onFilterChange: handleFilterChange,
    onReset: handleReset,
  },
}

export const WithActiveFilters: Story = {
  args: {
    filters: { ...defaultFilters, search: 'festa', year: 2026, tag: 'aniversário' },
    onFilterChange: handleFilterChange,
    onReset: handleReset,
  },
}
