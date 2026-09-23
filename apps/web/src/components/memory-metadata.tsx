'use client'

import { Tag, Users } from 'lucide-react'

interface Person {
  id: string
  name: string
}

interface TagItem {
  id: string
  name: string
}

interface MemoryMetadataProps {
  people: Person[]
  tags: TagItem[]
}

export function MemoryMetadata({ people, tags }: MemoryMetadataProps) {
  if (people.length === 0 && tags.length === 0) return null

  return (
    <div className="space-y-4">
      {people.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-muted">
            <Users className="h-4 w-4" />
            <span>Pessoas</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {people.map((person) => (
              <span
                key={person.id}
                className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-sm text-primary"
              >
                {person.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {tags.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-muted">
            <Tag className="h-4 w-4" />
            <span>Tags</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center rounded-full bg-background px-3 py-1 text-sm text-muted"
              >
                {tag.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
