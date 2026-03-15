import { ArrowLeftOutlined, DeleteOutlined, EditOutlined, UploadOutlined } from '@ant-design/icons'
import { Button, Card, Col, Descriptions, Form, Input, Modal, Popconfirm, Row, Select, Space, Table, Typography, Upload, message } from 'antd'
import type { UploadProps } from 'antd'
import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { useNavigate, useParams } from 'react-router-dom'

import { listMedia, queryMedia, uploadMedia } from '../api/media'
import { queryPlants } from '../api/plants'
import { deleteTag, getTagById, updateTag } from '../api/tags'
import { MediaCard } from '../components/MediaCard'
import { NotesEditor } from '../components/NotesEditor'
import { useIsMobile } from '../hooks/useIsMobile'
import type { Media, MediaListItem, Plant, Tag, TagCreate } from '../types/models'

export function TagDetailPage() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const { tagId } = useParams<{ tagId: string }>()
  const parsedTagId = Number(tagId)

  const [tag, setTag] = useState<Tag | null>(null)
  const [mediaOptions, setMediaOptions] = useState<MediaListItem[]>([])
  const [plants, setPlants] = useState<Plant[]>([])
  const [mediaItems, setMediaItems] = useState<Media[]>([])
  const [isEditModalOpen, setEditModalOpen] = useState(false)
  const [isAttachModalOpen, setAttachModalOpen] = useState(false)
  const [attachTitle, setAttachTitle] = useState('')
  const [form] = Form.useForm<TagCreate>()

  const attachUploadProps: UploadProps = {
    showUploadList: false,
    customRequest: async (options) => {
      if (!tag) {
        options.onError?.(new Error('No tag selected'))
        return
      }

      try {
        const file = options.file as File
        await uploadMedia(file, attachTitle || file.name, undefined, tag.id)
        message.success('Image attached to tag')
        setAttachTitle('')
        setAttachModalOpen(false)
        await loadData()
        options.onSuccess?.({}, file)
      } catch (error) {
        message.error((error as Error).message)
        options.onError?.(new Error('Upload failed'))
      }
    },
  }

  async function loadData() {
    if (!Number.isInteger(parsedTagId) || parsedTagId <= 0) {
      message.error('Invalid tag id')
      navigate('/tags')
      return
    }

    try {
      const [tagRecord, media, relatedPlants, relatedMedia] = await Promise.all([
        getTagById(parsedTagId),
        listMedia(200, 0, false),
        queryPlants({ tagId: parsedTagId, archived: false, limit: 200, offset: 0 }),
        queryMedia({ tagId: parsedTagId, limit: 200, offset: 0, includeFilePath: true }),
      ])

      setTag(tagRecord)
      setMediaOptions(media.items)
      setPlants(relatedPlants)
      setMediaItems(relatedMedia)
    } catch {
      message.error('Tag not found')
      navigate('/tags')
    }
  }

  useEffect(() => {
    void loadData()
  }, [navigate, parsedTagId])

  if (!tag) {
    return null
  }

  const mainMedia = tag.main_media_id
    ? mediaOptions.find((item) => item.id === tag.main_media_id)
    : undefined

  return (
    <Space direction='vertical' size={16} style={{ width: '100%' }}>
      <Space wrap>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/tags')}>
          Back to Tags
        </Button>
        <Button
          icon={<EditOutlined />}
          onClick={() => {
            form.setFieldsValue({
              name: tag.name,
              notes: tag.notes ?? undefined,
              main_media_id: tag.main_media_id ?? undefined,
            })
            setEditModalOpen(true)
          }}
        >
          Edit
        </Button>
        <Button onClick={() => navigate(`/plants?tagId=${tag.id}`)}>View Plants</Button>
        <Popconfirm
          title='Delete this tag?'
          onConfirm={async () => {
            await deleteTag(tag.id)
            message.success('Tag deleted')
            navigate('/tags')
          }}
        >
          <Button danger icon={<DeleteOutlined />}>Delete</Button>
        </Popconfirm>
      </Space>

      <Typography.Title level={3} style={{ margin: 0 }}>
        {tag.name}
      </Typography.Title>

      <Card>
        <Descriptions bordered column={1} size='small'>
          <Descriptions.Item label='Name'>{tag.name}</Descriptions.Item>
          <Descriptions.Item label='Main Photo'>
            {mainMedia?.title || mainMedia?.filename || (tag.main_media_id ? `Media #${tag.main_media_id}` : '-')}
          </Descriptions.Item>
          <Descriptions.Item label='Notes'>
            {tag.notes?.trim()
              ? (
                <div style={{ maxHeight: 240, overflowY: 'auto', paddingRight: 8 }}>
                  <ReactMarkdown>{tag.notes}</ReactMarkdown>
                </div>
                )
              : '-'}
          </Descriptions.Item>
          <Descriptions.Item label='Created At'>{tag.created_at}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title={`Plants with this tag (${plants.length})`}>
        <Table
          rowKey='id'
          size={isMobile ? 'small' : 'middle'}
          dataSource={plants}
          pagination={{ pageSize: 10, showSizeChanger: false }}
          onRow={(row) => ({
            onClick: () => navigate(`/plants/${row.id}`),
            style: { cursor: 'pointer' },
          })}
          columns={[
            {
              title: 'Name',
              render: (_, row) => (
                <Button type='link' style={{ padding: 0 }} onClick={() => navigate(`/plants/${row.id}`)}>
                  {row.name}
                </Button>
              ),
            },
            { title: 'Species', render: (_, row) => row.species?.common_name || row.species?.name || '-' },
            { title: 'Tags', render: (_, row) => row.tags.map((item) => item.name).join(', ') || '-' },
          ]}
        />
      </Card>

      <Card
        title={`Tag Images (${mediaItems.length})`}
        extra={(
          <Button
            type='primary'
            icon={<UploadOutlined />}
            onClick={() => {
              setAttachTitle('')
              setAttachModalOpen(true)
            }}
          >
            Add Image
          </Button>
        )}
      >
        {mediaItems.length === 0 ? (
          <Typography.Text type='secondary'>No images attached to this tag yet.</Typography.Text>
        ) : (
          <div style={{ maxHeight: isMobile ? 'none' : 420, overflowY: 'auto', paddingRight: isMobile ? 0 : 8 }}>
            <Row gutter={[16, 16]}>
              {mediaItems.map((item) => (
                <Col key={item.id} xs={24} sm={12} md={8} lg={6}>
                  <MediaCard media={item} mode='expand' />
                </Col>
              ))}
            </Row>
          </div>
        )}
      </Card>

      <Modal
        title='Edit Tag'
        open={isEditModalOpen}
        onCancel={() => {
          setEditModalOpen(false)
          form.resetFields()
        }}
        onOk={async () => {
          const values = await form.validateFields()
          await updateTag(tag.id, values)
          message.success('Tag updated')
          setEditModalOpen(false)
          await loadData()
        }}
      >
        <Form form={form} layout='vertical'>
          <Form.Item label='Name' name='name' rules={[{ required: true }]}> 
            <Input />
          </Form.Item>
          <Form.Item label='Notes' name='notes'>
            <NotesEditor height={280} />
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

      <Modal
        title={`Add Image: ${tag.name}`}
        open={isAttachModalOpen}
        onCancel={() => {
          setAttachModalOpen(false)
          setAttachTitle('')
        }}
        footer={null}
      >
        <Space direction='vertical' style={{ width: '100%' }} size={12}>
          <Input
            placeholder='Optional title'
            value={attachTitle}
            onChange={(event) => setAttachTitle(event.target.value)}
          />
          <Upload {...attachUploadProps}>
            <Button type='primary' icon={<UploadOutlined />}>Select Image</Button>
          </Upload>
        </Space>
      </Modal>
    </Space>
  )
}
