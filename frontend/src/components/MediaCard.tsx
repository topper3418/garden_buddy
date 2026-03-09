import { Card, Image, Typography } from 'antd'

import { mediaFileUrl } from '../api/media'
import type { Media } from '../types/models'

type MediaCardProps = {
  media: Media
  mode: 'navigate' | 'expand'
  onNavigateToPlant?: (plantId: number) => void
}

function formatTakenDate(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }
  return parsed.toLocaleDateString()
}

export function MediaCard({ media, mode, onNavigateToPlant }: MediaCardProps) {
  const canNavigate = mode === 'navigate' && media.plant_id !== null && media.plant_id !== undefined

  return (
    <Card
      hoverable={canNavigate || mode === 'expand'}
      style={{ width: 240 }}
      onClick={() => {
        if (canNavigate && media.plant_id !== null && media.plant_id !== undefined) {
          onNavigateToPlant?.(media.plant_id)
        }
      }}
      cover={
        <Image
          src={mediaFileUrl(media.id)}
          alt={media.title ?? media.filename}
          height={180}
          style={{ objectFit: 'cover' }}
          preview={mode === 'expand'}
          fallback='data:image/gif;base64,R0lGODlhAQABAAAAACw='
        />
      }
    >
      <Typography.Text strong>{media.title ?? media.filename}</Typography.Text>
      <br />
      <Typography.Text type='secondary'>Taken: {formatTakenDate(media.uploaded_at)}</Typography.Text>
    </Card>
  )
}
