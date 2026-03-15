import { Button, Form, Input, Modal, Select, Space, Table, Typography, message } from 'antd'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { listMedia } from '../api/media'
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
        scroll={{ x: 640 }}
        onRow={(row) => ({
          onClick: () => navigate(`/tags/${row.id}`),
          style: { cursor: 'pointer' },
        })}
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          pageSizeOptions: [10, 20, 50],
          showTotal: (total) => `${total} tags`,
        }}
        columns={[
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
          {
            title: 'Main Photo',
            render: (_, row) => {
              if (!row.main_media_id) return '-'
              const media = mediaOptions.find((item) => item.id === row.main_media_id)
              return media?.title || media?.filename || `Media #${row.main_media_id}`
            },
          },
        ]}
      />

      <Modal
        title='Create Tag'
        open={isModalOpen}
        onCancel={() => {
          setModalOpen(false)
          form.resetFields()
        }}
        onOk={() => void onSubmit()}
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
