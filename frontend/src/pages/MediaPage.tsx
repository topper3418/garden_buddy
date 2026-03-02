import { DeleteOutlined, UploadOutlined } from '@ant-design/icons'
import { Button, Image, Input, Popconfirm, Space, Table, Typography, Upload, message } from 'antd'
import type { UploadProps } from 'antd'
import { useEffect, useState } from 'react'

import { deleteMedia, listMedia, mediaFileUrl, queryMedia, uploadMedia } from '../api/media'
import type { MediaListItem } from '../types/models'

export function MediaPage() {
  const [items, setItems] = useState<MediaListItem[]>([])

  async function refresh() {
    const data = await listMedia(200, 0, true)
    setItems(data.items)
  }

  useEffect(() => {
    void refresh()
  }, [])

  const uploadProps: UploadProps = {
    showUploadList: false,
    customRequest: async (options) => {
      try {
        const file = options.file as File
        await uploadMedia(file, file.name)
        message.success('Upload complete')
        await refresh()
        options.onSuccess?.({}, file)
      } catch (error) {
        message.error((error as Error).message)
        options.onError?.(new Error('Upload failed'))
      }
    },
  }

  return (
    <>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>Media</Typography.Title>
        <Space>
          <Input.Search
            placeholder='Search title'
            onSearch={async (value) => {
              if (!value) {
                await refresh()
                return
              }
              const data = await queryMedia({ titleContains: value, limit: 200, offset: 0, includeFilePath: true })
              setItems(data)
            }}
            style={{ width: 240 }}
          />
          <Upload {...uploadProps}>
            <Button type='primary' icon={<UploadOutlined />}>Upload Image</Button>
          </Upload>
        </Space>
      </Space>

      <Table
        rowKey='id'
        dataSource={items}
        columns={[
          {
            title: 'Preview',
            render: (_, row) => (
              <Image
                width={72}
                height={72}
                style={{ objectFit: 'cover', borderRadius: 8 }}
                src={mediaFileUrl(row.id)}
                alt={row.filename}
                fallback='data:image/gif;base64,R0lGODlhAQABAAAAACw='
              />
            ),
          },
          { title: 'ID', dataIndex: 'id', width: 80 },
          { title: 'Title', dataIndex: 'title' },
          { title: 'Filename', dataIndex: 'filename' },
          { title: 'MIME', dataIndex: 'mime_type' },
          {
            title: 'Actions',
            render: (_, row) => (
              <Popconfirm
                title='Delete media?'
                onConfirm={async () => {
                  await deleteMedia(row.id)
                  message.success('Media deleted')
                  await refresh()
                }}
              >
                <Button danger icon={<DeleteOutlined />} />
              </Popconfirm>
            ),
          },
        ]}
      />
    </>
  )
}
