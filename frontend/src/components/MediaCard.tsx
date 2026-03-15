import { EditOutlined } from '@ant-design/icons'
import { Card, Image, Input, Modal, Space, Typography, message } from 'antd'
import { useState } from 'react'

import { mediaFileUrl, updateMedia } from '../api/media'
import { useIsMobile } from '../hooks/useIsMobile'
import type { Media } from '../types/models'

type MediaCardProps = {
  media: Media
  mode: 'navigate' | 'expand'
  onNavigateToPlant?: (plantId: number) => void
  onRenameMedia?: (id: number, newTitle: string) => void
}

function formatTakenDate(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }
  return parsed.toLocaleDateString()
}

export function MediaCard({ media, mode, onNavigateToPlant, onRenameMedia }: MediaCardProps) {
  const canNavigate = mode === 'navigate' && media.plant_id !== null && media.plant_id !== undefined
  const isMobile = useIsMobile()
  const [previewOpen, setPreviewOpen] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [renameLoading, setRenameLoading] = useState(false)

  async function onRenameConfirm() {
    const trimmed = renameValue.trim()
    if (!trimmed) return
    setRenameLoading(true)
    try {
      await updateMedia(media.id, { title: trimmed })
      message.success('Photo renamed')
      setRenameOpen(false)
      onRenameMedia?.(media.id, trimmed)
    } catch (error) {
      message.error((error as Error).message)
    } finally {
      setRenameLoading(false)
    }
  }

  return (
    <>
      <Card
        hoverable={canNavigate || mode === 'expand'}
        style={{ width: isMobile ? '100%' : 240, maxWidth: 320 }}
        onClick={() => {
          if (canNavigate && media.plant_id !== null && media.plant_id !== undefined) {
            onNavigateToPlant?.(media.plant_id)
          }
        }}
        cover={
          <Image
            src={mediaFileUrl(media.id)}
            alt={media.title ?? media.filename}
            height={isMobile ? 200 : 180}
            style={{ objectFit: 'cover' }}
            preview={mode === 'expand' ? {
              open: previewOpen,
              onVisibleChange: (visible) => setPreviewOpen(visible),
              toolbarRender: (originalNode) => (
                <Space size={16} style={{ alignItems: 'center' }}>
                  {originalNode}
                  <EditOutlined
                    style={{ fontSize: 18, color: '#fff', cursor: 'pointer', opacity: 0.85 }}
                    title='Rename photo'
                    onClick={() => {
                      setPreviewOpen(false)
                      setRenameValue(media.title ?? media.filename)
                      setRenameOpen(true)
                    }}
                  />
                </Space>
              ),
            } : false}
            fallback='data:image/gif;base64,R0lGODlhAQABAAAAACw='
          />
        }
      >
        <Typography.Text strong>{media.title ?? media.filename}</Typography.Text>
        <br />
        <Typography.Text type='secondary'>Taken: {formatTakenDate(media.uploaded_at)}</Typography.Text>
      </Card>

      <Modal
        title='Rename Photo'
        open={renameOpen}
        onOk={() => void onRenameConfirm()}
        onCancel={() => setRenameOpen(false)}
        confirmLoading={renameLoading}
        width={isMobile ? '95%' : 400}
        zIndex={2000}
      >
        <Input
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onPressEnter={() => void onRenameConfirm()}
          placeholder='Enter photo title'
          autoFocus
        />
      </Modal>
    </>
  )
}
