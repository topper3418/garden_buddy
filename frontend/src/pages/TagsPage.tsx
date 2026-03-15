import { Button, Form, Image, Input, Modal, Select, Space, Table, Typography, message } from 'antd'
import type { TableProps } from 'antd'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { listMedia, mediaFileUrl } from '../api/media'
import { createTag, listTags } from '../api/tags'
import { useIsMobile } from '../hooks/useIsMobile'
import type { MediaListItem, TagCreate, TagListItem } from '../types/models'

export function TagsPage() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [items, setItems] = useState<TagListItem[]>([])
  const [isModalOpen, setModalOpen] = useState(false)
  const [mediaOptions, setMediaOptions] = useState<MediaListItem[]>([])
  const [form] = Form.useForm<TagCreate>()

  async function refresh() {
    const [tags, media] = await Promise.all([listTags(200, 0), listMedia(200, 0, false)])
    setItems(tags.items)
    setMediaOptions(media.items)
  }

  useEffect(() => {
    void refresh()
  }, [])

  async function onSubmit() {
    const values = await form.validateFields()
    await createTag(values)
    message.success('Tag created')
    setModalOpen(false)
    form.resetFields()
    await refresh()
  }

  const tableColumns: TableProps<TagListItem>['columns'] = isMobile
    ? [
        {
          title: 'Tag',
          render: (_, row) => {
            return (
              <div style={{ lineHeight: 1.3, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                {row.main_media_id && (
                  <Image
                    src={mediaFileUrl(row.main_media_id)}
                    width={36}
                    height={36}
                    style={{ objectFit: 'cover', borderRadius: 4, flexShrink: 0 }}
                    preview={false}
                    fallback='data:image/gif;base64,R0lGODlhAQABAAAAACw='
                  />
                )}
                <div style={{ minWidth: 0 }}>
                  <Button
                    type='link'
                    style={{ padding: 0, textAlign: 'left', height: 'auto', whiteSpace: 'normal' }}
                    onClick={() => navigate(`/tags/${row.id}`)}
                  >
                    {row.name}
                  </Button>
                </div>
              </div>
            )
          },
        },
      ]
    : [
        {
          title: '',
          width: 56,
          render: (_, row) => row.main_media_id ? (
            <Image
              src={mediaFileUrl(row.main_media_id)}
              width={40}
              height={40}
              style={{ objectFit: 'cover', borderRadius: 4 }}
              preview={false}
              fallback='data:image/gif;base64,R0lGODlhAQABAAAAACw='
            />
          ) : null,
        },
        {
          title: 'Name',
          render: (_, row) => (
            <Button
              type='link'
              style={{ padding: 0 }}
              onClick={() => navigate(`/tags/${row.id}`)}
            >
              {row.name}
            </Button>
          ),
        },
      ]

  return (
    <>
      <Space
        wrap
        direction={isMobile ? 'vertical' : 'horizontal'}
        style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}
      >
        <Typography.Title level={3} style={{ margin: 0 }}>Tags</Typography.Title>
        <Button type='primary' onClick={() => setModalOpen(true)}>New Tag</Button>
      </Space>

      <Table
        rowKey='id'
        dataSource={items}
        size={isMobile ? 'small' : 'middle'}
        scroll={isMobile ? undefined : { x: 640 }}
        tableLayout={isMobile ? 'fixed' : undefined}
        onRow={(row) => ({
          onClick: () => navigate(`/tags/${row.id}`),
          style: { cursor: 'pointer' },
        })}
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          pageSizeOptions: [10, 20, 50],
          showTotal: (total) => `${total} tags`,
          size: isMobile ? 'small' : undefined,
          simple: isMobile,
        }}
        columns={tableColumns}
      />

      <Modal
        title='Create Tag'
        open={isModalOpen}
        onCancel={() => {
          setModalOpen(false)
          form.resetFields()
        }}
        onOk={() => void onSubmit()}
        width={isMobile ? '100%' : 560}
      >
        <Form form={form} layout='vertical'>
          <Form.Item label='Name' name='name' rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label='Notes' name='notes'>
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item label='Main Photo' name='main_media_id'>
            <Select
              allowClear
              options={mediaOptions.map((item) => ({
                value: item.id,
                label: item.title || item.filename,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
