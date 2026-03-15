import { ArrowLeftOutlined, DeleteOutlined, EditOutlined, UploadOutlined } from '@ant-design/icons'
import { Button, Card, Col, Descriptions, Form, Input, Modal, Popconfirm, Row, Select, Space, Table, Typography, Upload, message } from 'antd'
import type { UploadProps } from 'antd'
import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { useNavigate, useParams } from 'react-router-dom'

import { askSpeciesQuestion, generateSpeciesDraft } from '../api/ai'
import { API_QUERY_LIMIT_MAX } from '../api/limits'
import { queryMedia, uploadMedia } from '../api/media'
import { deleteSpecies, getSpeciesById, querySpecies, updateSpecies } from '../api/species'
import { queryPlants } from '../api/plants'
import { MediaCard } from '../components/MediaCard'
import { NotesEditor } from '../components/NotesEditor'
import { useIsMobile } from '../hooks/useIsMobile'
import type { Media, Plant, Species, SpeciesCreate } from '../types/models'

function collectDescendantSpeciesIds(rootId: number, species: Species[]): number[] {
  const childrenByParent = new Map<number, number[]>()

  for (const item of species) {
    if (!item.parent_species_id) {
      continue
    }
    const siblings = childrenByParent.get(item.parent_species_id) ?? []
    siblings.push(item.id)
    childrenByParent.set(item.parent_species_id, siblings)
  }

  const ids: number[] = []
  const stack: number[] = [rootId]
  while (stack.length > 0) {
    const current = stack.pop()
    if (!current || ids.includes(current)) {
      continue
    }
    ids.push(current)
    const children = childrenByParent.get(current) ?? []
    for (const childId of children) {
      stack.push(childId)
    }
  }

  return ids
}

export function SpeciesDetailPage() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const { speciesId } = useParams<{ speciesId: string }>()
  const parsedSpeciesId = Number(speciesId)

  const [species, setSpecies] = useState<Species | null>(null)
  const [speciesOptions, setSpeciesOptions] = useState<Species[]>([])
  const [plants, setPlants] = useState<Plant[]>([])
  const [mediaItems, setMediaItems] = useState<Media[]>([])
  const [isEditModalOpen, setEditModalOpen] = useState(false)
  const [isAttachModalOpen, setAttachModalOpen] = useState(false)
  const [attachTitle, setAttachTitle] = useState('')
  const [attachPlantId, setAttachPlantId] = useState<number | undefined>(undefined)
  const [isGeneratingDraft, setGeneratingDraft] = useState(false)
  const [question, setQuestion] = useState('')
  const [isAskingQuestion, setAskingQuestion] = useState(false)
  const [aiAnswer, setAiAnswer] = useState<string | null>(null)
  const [aiSuggestedNote, setAiSuggestedNote] = useState<string | null>(null)
  const [isApplyingSuggestedNote, setApplyingSuggestedNote] = useState(false)
  const [form] = Form.useForm<SpeciesCreate>()

  const attachUploadProps: UploadProps = {
    showUploadList: false,
    customRequest: async (options) => {
      if (!attachPlantId) {
        message.error('Choose a plant before uploading')
        options.onError?.(new Error('No plant selected'))
        return
      }

      try {
        const file = options.file as File
        await uploadMedia(file, attachTitle || file.name, attachPlantId)
        message.success('Image added to species gallery')
        setAttachTitle('')
        setAttachPlantId(undefined)
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
    if (!Number.isInteger(parsedSpeciesId) || parsedSpeciesId <= 0) {
      message.error('Invalid species id')
      navigate('/species')
      return
    }

    try {
      const [speciesRecord, allSpecies] = await Promise.all([
        getSpeciesById(parsedSpeciesId),
        querySpecies({ limit: API_QUERY_LIMIT_MAX, offset: 0 }),
      ])

      const descendantIds = collectDescendantSpeciesIds(parsedSpeciesId, allSpecies)
      const [relatedPlants, relatedMedia] = await Promise.all([
        queryPlants({
          speciesIds: descendantIds,
          archived: false,
          limit: API_QUERY_LIMIT_MAX,
          offset: 0,
        }),
        queryMedia({
          speciesIds: descendantIds,
          limit: API_QUERY_LIMIT_MAX,
          offset: 0,
          includeFilePath: true,
        }),
      ])

      setSpecies(speciesRecord)
      setSpeciesOptions(allSpecies)
      setPlants(relatedPlants)
      setMediaItems(relatedMedia)
    } catch {
      message.error('Species not found')
      navigate('/species')
    }
  }

  useEffect(() => {
    void loadData()
  }, [navigate, parsedSpeciesId])

  if (!species) {
    return null
  }

  const parentSpecies = species.parent_species_id
    ? speciesOptions.find((item) => item.id === species.parent_species_id)
    : undefined
  const speciesIdValue = species.id
  const speciesNotesValue = species.notes

  async function onGenerateDraft() {
    const enteredName = String(form.getFieldValue('name') ?? '').trim()
    if (!enteredName) {
      return
    }

    setGeneratingDraft(true)
    try {
      const draft = await generateSpeciesDraft(enteredName)
      form.setFieldsValue({
        name: draft.name,
        common_name: draft.common_name ?? undefined,
        notes: draft.notes,
      })
      message.success('AI species draft generated')
    } catch (error) {
      message.error((error as Error).message)
    } finally {
      setGeneratingDraft(false)
    }
  }

  async function onAskQuestion() {
    const trimmed = question.trim()
    if (!trimmed) {
      return
    }

    setAskingQuestion(true)
    try {
      const response = await askSpeciesQuestion(speciesIdValue, trimmed)
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
      const existingNotes = speciesNotesValue?.trim() ?? ''
      const mergedNotes = existingNotes ? `${existingNotes}\n\n---\n\n${suggestion}` : suggestion
      await updateSpecies(speciesIdValue, { notes: mergedNotes })
      message.success('Species notes updated from AI suggestion')
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
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/species')}>
          Back to Species
        </Button>
        <Button
          icon={<EditOutlined />}
          onClick={() => {
            form.setFieldsValue({
              name: species.name,
              common_name: species.common_name ?? undefined,
              notes: species.notes ?? undefined,
              parent_species_id: species.parent_species_id ?? undefined,
            })
            setEditModalOpen(true)
          }}
        >
          Edit
        </Button>
        <Button
          onClick={() => {
            document.getElementById('species-assistant-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }}
        >
          AI Assistant
        </Button>
        <Button onClick={() => navigate(`/plants?speciesIds=${species.id}`)}>View Plants</Button>
        <Popconfirm
          title='Delete this species?'
          description='This may fail if subspecies or plant references still exist.'
          onConfirm={async () => {
            try {
              await deleteSpecies(species.id)
              message.success('Species deleted')
              navigate('/species')
            } catch {
              message.error('Could not delete species (subspecies or plant references may exist)')
            }
          }}
        >
          <Button danger icon={<DeleteOutlined />}>Delete</Button>
        </Popconfirm>
      </Space>

      <Typography.Title level={3} style={{ margin: 0 }}>
        {species.common_name?.trim() || species.name}
      </Typography.Title>

      <Card>
        <Descriptions bordered column={1} size='small'>
          <Descriptions.Item label='Scientific Name'>{species.name}</Descriptions.Item>
          <Descriptions.Item label='Common Name'>{species.common_name || '-'}</Descriptions.Item>
          <Descriptions.Item label='Parent Species'>{parentSpecies?.name || '-'}</Descriptions.Item>
          <Descriptions.Item label='Plant Count'>{species.plant_count}</Descriptions.Item>
          <Descriptions.Item label='Notes'>
            {species.notes?.trim()
              ? (
                <div style={{ maxHeight: 240, overflowY: 'auto', paddingRight: 8 }}>
                  <ReactMarkdown>{species.notes}</ReactMarkdown>
                </div>
                )
              : '-'}
          </Descriptions.Item>
          <Descriptions.Item label='Created At'>{species.created_at}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card id='species-assistant-card' title='Species Assistant'>
        <Space direction='vertical' style={{ width: '100%' }} size={12}>
          <Input.TextArea
            rows={3}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder='Ask about care, watering, light, pruning, pests, or seasonal planning.'
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
                Add Suggestion to Species Notes
              </Button>
            </div>
          )}
        </Space>
      </Card>

      <Card title={`Plants (${plants.length})`}>
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
        title={`Species Images (${mediaItems.length})`}
        extra={(
          <Button
            type='primary'
            icon={<UploadOutlined />}
            disabled={plants.length === 0}
            onClick={() => {
              setAttachTitle('')
              setAttachPlantId(plants[0]?.id)
              setAttachModalOpen(true)
            }}
          >
            Add Image
          </Button>
        )}
      >
        {plants.length === 0 ? (
          <Typography.Text type='secondary'>Add a plant to this species before attaching images.</Typography.Text>
        ) : mediaItems.length === 0 ? (
          <Typography.Text type='secondary'>No images attached to this species yet.</Typography.Text>
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
        title='Edit Species'
        open={isEditModalOpen}
        onCancel={() => {
          setEditModalOpen(false)
          form.resetFields()
        }}
        onOk={async () => {
          const values = await form.validateFields()
          await updateSpecies(species.id, values)
          message.success('Species updated')
          setEditModalOpen(false)
          await loadData()
        }}
      >
        <Form form={form} layout='vertical'>
          <Form.Item label='Scientific Name' name='name' rules={[{ required: true }]}> 
            <Input />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(previous, current) => previous.name !== current.name}>
            {() => {
              const canGenerate = String(form.getFieldValue('name') ?? '').trim().length >= 3
              return (
                <Form.Item>
                  <Button
                    onClick={() => void onGenerateDraft()}
                    loading={isGeneratingDraft}
                    disabled={!canGenerate}
                  >
                    Generate Details with AI
                  </Button>
                </Form.Item>
              )
            }}
          </Form.Item>
          <Form.Item label='Common Name' name='common_name'>
            <Input />
          </Form.Item>
          <Form.Item label='Parent Species' name='parent_species_id'>
            <Select
              allowClear
              options={speciesOptions
                .filter((item) => item.id !== species.id)
                .map((item) => ({
                  value: item.id,
                  label: item.common_name?.trim() || item.name,
                }))}
            />
          </Form.Item>
          <Form.Item label='Notes' name='notes'>
            <NotesEditor height={280} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`Add Image: ${species.common_name?.trim() || species.name}`}
        open={isAttachModalOpen}
        onCancel={() => {
          setAttachModalOpen(false)
          setAttachTitle('')
          setAttachPlantId(undefined)
        }}
        footer={null}
      >
        <Space direction='vertical' style={{ width: '100%' }} size={12}>
          <Select
            placeholder='Choose plant'
            value={attachPlantId}
            onChange={(value) => setAttachPlantId(value)}
            options={plants.map((item) => ({ value: item.id, label: item.name }))}
          />
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
