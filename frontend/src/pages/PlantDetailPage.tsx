import { ArrowLeftOutlined, DeleteOutlined, EditOutlined, UploadOutlined } from '@ant-design/icons'
import { Button, Card, Col, Descriptions, Form, Input, Modal, Popconfirm, Row, Select, Space, Tag, Typography, Upload, message } from 'antd'
import type { UploadProps } from 'antd'
import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { useNavigate, useParams } from 'react-router-dom'

import { askPlantQuestion } from '../api/ai'
import { queryMedia, uploadMedia } from '../api/media'
import { MediaCard } from '../components/MediaCard'
import { NotesEditor } from '../components/NotesEditor'
import { deletePlant, getPlantById, updatePlant } from '../api/plants'
import { listTags } from '../api/tags'
import { querySpecies } from '../api/species'
import { useIsMobile } from '../hooks/useIsMobile'
import type { Media, Plant, PlantCreate, TagListItem, Species } from '../types/models'

export function PlantDetailPage() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const { plantId } = useParams<{ plantId: string }>()
  const parsedPlantId = Number(plantId)

  const [plant, setPlant] = useState<Plant | null>(null)
  const [mediaItems, setMediaItems] = useState<Media[]>([])
  const [speciesOptions, setSpeciesOptions] = useState<Species[]>([])
  const [tagOptions, setTagOptions] = useState<TagListItem[]>([])
  const [isEditModalOpen, setEditModalOpen] = useState(false)
  const [isAttachModalOpen, setAttachModalOpen] = useState(false)
  const [attachTitle, setAttachTitle] = useState('')
  const [question, setQuestion] = useState('')
  const [isAskingQuestion, setAskingQuestion] = useState(false)
  const [aiAnswer, setAiAnswer] = useState<string | null>(null)
  const [aiSuggestedNote, setAiSuggestedNote] = useState<string | null>(null)
  const [isApplyingSuggestedNote, setApplyingSuggestedNote] = useState(false)
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
      const [plantRecord, media, species, tags] = await Promise.all([
          getPlantById(parsedPlantId, true),
        queryMedia({ plantId: parsedPlantId, limit: 200, offset: 0, includeFilePath: true }),
        querySpecies({ limit: 200, offset: 0 }),
        listTags(200, 0),
      ])

      setPlant(plantRecord)
      setMediaItems(media)
      setSpeciesOptions(species)
      setTagOptions(tags.items)
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
  const plantIdValue = plant.id
  const plantNotesValue = plant.notes

  async function onAskQuestion() {
    const trimmed = question.trim()
    if (!trimmed) {
      return
    }

    setAskingQuestion(true)
    try {
      const response = await askPlantQuestion(plantIdValue, trimmed)
      setAiAnswer(response.answer_markdown)
      setAiSuggestedNote(response.suggested_note_update_markdown ?? null)
    } catch (error) {
      message.error((error as Error).message)
    } finally {
      setAskingQuestion(false)
    }
  }

  async function onApplySuggestedNote() {
    const suggestion = aiSuggestedNote?.trim()
    if (!suggestion) {
      return
    }

    setApplyingSuggestedNote(true)
    try {
      const existingNotes = plantNotesValue?.trim() ?? ''
      const mergedNotes = existingNotes ? `${existingNotes}\n\n---\n\n${suggestion}` : suggestion
      await updatePlant(plantIdValue, { notes: mergedNotes })
      message.success('Plant notes updated from AI suggestion')
      await loadData()
    } catch (error) {
      message.error((error as Error).message)
    } finally {
      setApplyingSuggestedNote(false)
    }
  }

  return (
    <Space direction='vertical' size={16} style={{ width: '100%' }}>
      <Space wrap>
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
              tag_ids: plant.tag_ids,
              main_media_id: plant.main_media_id ?? undefined,
            })
            setEditModalOpen(true)
          }}
        >
          Edit
        </Button>
        <Button
          onClick={() => {
            document.getElementById('plant-assistant-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }}
        >
          AI Assistant
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
          <Descriptions.Item label='Tags'>
            <Space wrap>
              {plant.tags.length > 0
                ? plant.tags.map((item) => <Tag key={item.id}>{item.name}</Tag>)
                : '-'}
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label='Main Photo'>
            {plant.main_media_id
              ? (mediaItems.find((item) => item.id === plant.main_media_id)?.title
                  || mediaItems.find((item) => item.id === plant.main_media_id)?.filename
                  || `Media #${plant.main_media_id}`)
              : '-'}
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

      <Card id='plant-assistant-card' title='Plant Assistant'>
        <Space direction='vertical' style={{ width: '100%' }} size={12}>
          <Input.TextArea
            rows={3}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder='Ask about this plant care plan, watering cadence, troubleshooting, or seasonal actions.'
          />
          <Button
            type='primary'
            loading={isAskingQuestion}
            disabled={question.trim().length < 3}
            onClick={() => void onAskQuestion()}
          >
            Ask AI
          </Button>
          {aiAnswer && (
            <div style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: 12 }}>
              <ReactMarkdown>{aiAnswer}</ReactMarkdown>
            </div>
          )}
          {aiSuggestedNote && aiSuggestedNote.trim() && (
            <div style={{ border: '1px dashed #d9d9d9', borderRadius: 8, padding: 12 }}>
              <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
                Suggested note update
              </Typography.Text>
              <ReactMarkdown>{aiSuggestedNote}</ReactMarkdown>
              <Button
                style={{ marginTop: 8 }}
                loading={isApplyingSuggestedNote}
                onClick={() => void onApplySuggestedNote()}
              >
                Add Suggestion to Plant Notes
              </Button>
            </div>
          )}
        </Space>
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
            tag_ids: values.tag_ids ?? [],
            main_media_id: values.main_media_id ?? null,
          }
          await updatePlant(plant.id, payload)
          message.success('Plant updated')
          setEditModalOpen(false)
          await loadData()
        }}
        width={isMobile ? '100%' : 860}
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
          <Form.Item label='Tags' name='tag_ids'>
            <Select
              mode='multiple'
              allowClear
              options={tagOptions.map((item) => ({ value: item.id, label: item.name }))}
            />
          </Form.Item>
          <Form.Item label='Main Photo' name='main_media_id'>
            <Select
              allowClear
              options={mediaItems.map((item) => ({ value: item.id, label: item.title || item.filename }))}
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
