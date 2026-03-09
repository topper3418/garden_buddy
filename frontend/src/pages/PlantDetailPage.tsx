import { ArrowLeftOutlined, DeleteOutlined, EditOutlined, UploadOutlined } from '@ant-design/icons'
import { Button, Card, Col, Descriptions, Form, Input, Modal, Popconfirm, Row, Select, Space, Tag, Typography, Upload, message } from 'antd'
import type { UploadProps } from 'antd'
import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { useNavigate, useParams } from 'react-router-dom'

import { queryMedia, uploadMedia } from '../api/media'
import { MediaCard } from '../components/MediaCard'
import { NotesEditor } from '../components/NotesEditor'
import { deletePlant, getPlantById, updatePlant } from '../api/plants'
import { listPlantTypes } from '../api/plantTypes'
import { querySpecies } from '../api/species'
import type { Media, Plant, PlantCreate, PlantTypeListItem, Species } from '../types/models'

export function PlantDetailPage() {
  const navigate = useNavigate()
  const { plantId } = useParams<{ plantId: string }>()
  const parsedPlantId = Number(plantId)

  const [plant, setPlant] = useState<Plant | null>(null)
  const [mediaItems, setMediaItems] = useState<Media[]>([])
  const [speciesOptions, setSpeciesOptions] = useState<Species[]>([])
  const [typeOptions, setTypeOptions] = useState<PlantTypeListItem[]>([])
  const [isEditModalOpen, setEditModalOpen] = useState(false)
  const [isAttachModalOpen, setAttachModalOpen] = useState(false)
  const [attachTitle, setAttachTitle] = useState('')
  const [form] = Form.useForm<PlantCreate>()

  const attachUploadProps: UploadProps = {
    showUploadList: false,
    customRequest: async (options) => {
      if (!plant) {
        options.onError?.(new Error('No plant selected'))
        return
      }

      try {
        const file = options.file as File
        await uploadMedia(file, attachTitle || file.name, plant.id)
        message.success('Media attached')
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
    if (!Number.isInteger(parsedPlantId) || parsedPlantId <= 0) {
      message.error('Invalid plant id')
      navigate('/plants')
      return
    }

    try {
      const [plantRecord, media, species, plantTypes] = await Promise.all([
          getPlantById(parsedPlantId, true),
        queryMedia({ plantId: parsedPlantId, limit: 200, offset: 0, includeFilePath: true }),
        querySpecies({ limit: 200, offset: 0 }),
        listPlantTypes(200, 0),
      ])

      setPlant(plantRecord)
      setMediaItems(media)
      setSpeciesOptions(species)
      setTypeOptions(plantTypes.items)
    } catch {
      message.error('Plant not found')
      navigate('/plants')
    }
  }

  useEffect(() => {
    void loadData()
  }, [navigate, parsedPlantId])

  if (!plant) {
    return null
  }

  return (
    <Space direction='vertical' size={16} style={{ width: '100%' }}>
      <Space>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/plants')}>
          Back to Plants
        </Button>
        <Button
          icon={<EditOutlined />}
          onClick={() => {
            form.setFieldsValue({
              name: plant.name,
              notes: plant.notes ?? undefined,
              species_id: plant.species_id ?? undefined,
              plant_type_ids: plant.plant_type_ids,
            })
            setEditModalOpen(true)
          }}
        >
          Edit
        </Button>
        <Popconfirm
          title='Soft delete this plant?'
          description='Plant notes and media links are preserved.'
          onConfirm={async () => {
            await deletePlant(plant.id)
            message.success('Plant archived')
            navigate('/plants')
          }}
        >
          <Button danger icon={<DeleteOutlined />}>Archive</Button>
        </Popconfirm>
      </Space>

      <Typography.Title level={3} style={{ margin: 0 }}>
        {plant.name}
      </Typography.Title>

      <Card>
        <Descriptions bordered column={1} size='small'>
          <Descriptions.Item label='Name'>{plant.name}</Descriptions.Item>
          <Descriptions.Item label='Species'>{plant.species?.name ?? '-'}</Descriptions.Item>
          <Descriptions.Item label='Common Name'>{plant.species?.common_name ?? '-'}</Descriptions.Item>
          <Descriptions.Item label='Plant Types'>
            <Space wrap>
              {plant.plant_types.length > 0
                ? plant.plant_types.map((item) => <Tag key={item.id}>{item.name}</Tag>)
                : '-'}
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label='Notes'>
            {plant.notes?.trim()
              ? (
                <div style={{ maxHeight: 240, overflowY: 'auto', paddingRight: 8 }}>
                  <ReactMarkdown>{plant.notes}</ReactMarkdown>
                </div>
              )
              : '-'}
          </Descriptions.Item>
          <Descriptions.Item label='Created At'>{plant.created_at}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card
        title='Attached Media'
        extra={(
          <Button
            type='primary'
            icon={<UploadOutlined />}
            onClick={() => {
              setAttachTitle('')
              setAttachModalOpen(true)
            }}
          >
            Add Media
          </Button>
        )}
      >
        {mediaItems.length === 0 ? (
          <Typography.Text type='secondary'>No media attached to this plant yet.</Typography.Text>
        ) : (
          <div style={{ maxHeight: 420, overflowY: 'auto', paddingRight: 8 }}>
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
        title='Edit Plant'
        open={isEditModalOpen}
        onCancel={() => {
          setEditModalOpen(false)
          form.resetFields()
        }}
        onOk={async () => {
          const values = await form.validateFields()
          const payload: PlantCreate = {
            name: values.name,
            notes: values.notes,
            species_id: values.species_id ?? null,
            plant_type_ids: values.plant_type_ids ?? [],
          }
          await updatePlant(plant.id, payload)
          message.success('Plant updated')
          setEditModalOpen(false)
          await loadData()
        }}
        width={860}
      >
        <Form form={form} layout='vertical'>
          <Form.Item label='Name' name='name' rules={[{ required: true }]}> 
            <Input />
          </Form.Item>
          <Form.Item label='Species' name='species_id'>
            <Select
              allowClear
              options={speciesOptions.map((item) => ({
                value: item.id,
                label: item.common_name?.trim() || item.name,
              }))}
            />
          </Form.Item>
          <Form.Item label='Plant Types' name='plant_type_ids'>
            <Select
              mode='multiple'
              allowClear
              options={typeOptions.map((item) => ({ value: item.id, label: item.name }))}
            />
          </Form.Item>
          <Form.Item label='Notes' name='notes'>
            <NotesEditor height={300} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`Add Media: ${plant.name}`}
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
