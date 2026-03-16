import { Button, Form, Image, Input, Modal, Select, Space, Table, Typography, message } from 'antd'
import type { TableProps } from 'antd'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { generateSpeciesDraft } from '../api/ai'
import { API_QUERY_LIMIT_MAX } from '../api/limits'
import { listMedia, mediaFileUrl } from '../api/media'
import { createSpecies, querySpecies } from '../api/species'
import { useIsMobile } from '../hooks/useIsMobile'
import type { SpeciesCreate, Species, MediaListItem } from '../types/models'

type SpeciesTreeNode = Species & {
  children?: SpeciesTreeNode[]
}

function sortByLabel<T extends { label: string }>(options: T[]): T[] {
  return [...options].sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
}

function buildTreeRenderKey(nodes: SpeciesTreeNode[]): string {
  return nodes
    .map((node) => `${node.id}:${node.children?.length ?? 0}:${buildTreeRenderKey(node.children ?? [])}`)
    .join('|')
}

function buildSpeciesTree(species: Species[]): SpeciesTreeNode[] {
  const byId = new Map<number, SpeciesTreeNode>()

  for (const item of species) {
    byId.set(item.id, { ...item, children: [] })
  }

  const roots: SpeciesTreeNode[] = []

  for (const item of byId.values()) {
    if (item.parent_species_id && byId.has(item.parent_species_id)) {
      byId.get(item.parent_species_id)?.children?.push(item)
    } else {
      roots.push(item)
    }
  }

  const sortTree = (nodes: SpeciesTreeNode[]) => {
    nodes.sort((a, b) => a.name.localeCompare(b.name))
    for (const node of nodes) {
      if (node.children && node.children.length > 0) {
        sortTree(node.children)
      }
    }
  }

  sortTree(roots)
  return roots
}

export function SpeciesPage() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [items, setItems] = useState<SpeciesTreeNode[]>([])
  const [speciesOptions, setSpeciesOptions] = useState<Species[]>([])
  const [mediaOptions, setMediaOptions] = useState<MediaListItem[]>([])
  const [isModalOpen, setModalOpen] = useState(false)
  const [isGeneratingDraft, setGeneratingDraft] = useState(false)
  const [form] = Form.useForm<SpeciesCreate>()
  const tableRenderKey = buildTreeRenderKey(items)
  const parentSpeciesOptions = sortByLabel(speciesOptions.map((item) => ({
    value: item.id,
    label: item.common_name?.trim() || item.name,
  })))
  const mediaSelectOptions = sortByLabel(mediaOptions.map((item) => ({
    value: item.id,
    label: item.title || item.filename,
  })))

  async function refresh() {
    const [data, media] = await Promise.all([
      querySpecies({ limit: API_QUERY_LIMIT_MAX, offset: 0 }),
      listMedia(200, 0, false),
    ])
    setSpeciesOptions(data)
    setItems(buildSpeciesTree(data))
    setMediaOptions(media.items)
  }

  useEffect(() => {
    void refresh()
  }, [])

  async function onSubmit() {
    const values = await form.validateFields()
    await createSpecies(values)
    message.success('Species created')
    setModalOpen(false)
    form.resetFields()
    await refresh()
  }

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

  const mobileColumns: TableProps<SpeciesTreeNode>['columns'] = [
    {
      title: 'Species',
      render: (_, row) => (
        <div style={{ lineHeight: 1.25, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
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
              onClick={(event) => {
                event.stopPropagation()
                navigate(`/species/${row.id}`)
              }}
            >
              {row.name}
            </Button>
            {row.common_name?.trim() && (
              <Typography.Text type='secondary' style={{ fontSize: 12 }}>
                {row.common_name}
              </Typography.Text>
            )}
          </div>
        </div>
      ),
    },
    {
      title: 'Stats',
      width: 108,
      render: (_, row) => (
        <div style={{ lineHeight: 1.3 }}>
          <Typography.Text style={{ fontSize: 12, display: 'block' }}>Plants: {row.plant_count}</Typography.Text>
          <Typography.Text type='secondary' style={{ fontSize: 12, display: 'block' }}>
            Subs: {row.children?.length ?? 0}
          </Typography.Text>
        </div>
      ),
    },
  ]

  const desktopColumns: TableProps<SpeciesTreeNode>['columns'] = [
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
          onClick={(event) => {
            event.stopPropagation()
            navigate(`/species/${row.id}`)
          }}
        >
          {row.name}
        </Button>
      ),
    },
    { title: 'Common Name', dataIndex: 'common_name' },
    {
      title: 'Plants',
      render: (_, row) => row.plant_count,
      width: 100,
    },
    {
      title: 'Subspecies',
      render: (_, row) => row.children?.length ?? 0,
      width: 120,
    },
  ]

  return (
    <>
      <div className='view-banner'>
        <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
          <Typography.Title level={3} style={{ margin: 0 }}>Species</Typography.Title>
          <div className='view-banner__controls'>
            <Button type='primary' onClick={() => setModalOpen(true)}>New Species</Button>
          </div>
        </Space>
      </div>

      <Table
        key={tableRenderKey}
        rowKey='id'
        dataSource={items}
        size={isMobile ? 'small' : 'middle'}
        scroll={isMobile ? undefined : { x: 860 }}
        tableLayout={isMobile ? 'fixed' : undefined}
        onRow={isMobile
          ? undefined
          : (row) => ({
              onClick: () => navigate(`/species/${row.id}`),
              style: { cursor: 'pointer' },
            })}
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          pageSizeOptions: [10, 20, 50],
          showTotal: (total) => `${total} species`,
          size: isMobile ? 'small' : undefined,
          simple: isMobile,
        }}
        expandable={{
          defaultExpandAllRows: true,
          rowExpandable: (row) => (row.children?.length ?? 0) > 0,
          columnWidth: isMobile ? 28 : undefined,
          indentSize: isMobile ? 12 : 24,
          expandRowByClick: isMobile,
        }}
        columns={isMobile ? mobileColumns : desktopColumns}
      />

      <Modal
        title='Create Species'
        open={isModalOpen}
        onCancel={() => {
          setModalOpen(false)
          form.resetFields()
        }}
        onOk={() => void onSubmit()}
        width={isMobile ? '100%' : 640}
      >
        <Form form={form} layout='vertical'>
          <Form.Item label='Name' name='name' rules={[{ required: true }]}>
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
              showSearch
              virtual={false}
              optionFilterProp='label'
              getPopupContainer={(triggerNode) => triggerNode.parentElement ?? document.body}
              options={parentSpeciesOptions}
            />
          </Form.Item>
          <Form.Item label='Notes' name='notes'>
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item label='Main Photo' name='main_media_id'>
            <Select
              allowClear
              showSearch
              virtual={false}
              optionFilterProp='label'
              getPopupContainer={(triggerNode) => triggerNode.parentElement ?? document.body}
              options={mediaSelectOptions}
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
