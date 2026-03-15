import { Button, Form, Input, Modal, Space, Table, Typography, message } from 'antd'
import type { TableProps } from 'antd'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { generateSpeciesDraft } from '../api/ai'
import { API_QUERY_LIMIT_MAX } from '../api/limits'
import { createSpecies, querySpecies } from '../api/species'
import { useIsMobile } from '../hooks/useIsMobile'
import type { SpeciesCreate, Species } from '../types/models'

type SpeciesTreeNode = Species & {
  children?: SpeciesTreeNode[]
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
  const [isModalOpen, setModalOpen] = useState(false)
  const [isGeneratingDraft, setGeneratingDraft] = useState(false)
  const [form] = Form.useForm<SpeciesCreate>()

  async function refresh() {
    const data = await querySpecies({ limit: API_QUERY_LIMIT_MAX, offset: 0 })
    setItems(buildSpeciesTree(data))
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
        <div style={{ lineHeight: 1.25, minWidth: 0 }}>
          <Button
            type='link'
            style={{ padding: 0, textAlign: 'left', height: 'auto', whiteSpace: 'normal' }}
            onClick={() => navigate(`/species/${row.id}`)}
          >
            {row.name}
          </Button>
          {row.common_name?.trim() && (
            <Typography.Text type='secondary' style={{ fontSize: 12 }}>
              {row.common_name}
            </Typography.Text>
          )}
        </div>
      ),
    },
    {
      title: 'Stats',
      width: 116,
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
      title: 'Name',
      render: (_, row) => (
        <Button type='link' style={{ padding: 0 }} onClick={() => navigate(`/species/${row.id}`)}>
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
      <Space
        wrap
        direction={isMobile ? 'vertical' : 'horizontal'}
        style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}
      >
        <Typography.Title level={3} style={{ margin: 0 }}>Species</Typography.Title>
        <Button type='primary' onClick={() => setModalOpen(true)}>New Species</Button>
      </Space>

      <Table
        rowKey='id'
        dataSource={items}
        size={isMobile ? 'small' : 'middle'}
        scroll={isMobile ? undefined : { x: 860 }}
        tableLayout={isMobile ? 'fixed' : undefined}
        onRow={(row) => ({
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
          defaultExpandAllRows: false,
          rowExpandable: (row) => (row.children?.length ?? 0) > 0,
          columnWidth: isMobile ? 28 : undefined,
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
          <Form.Item label='Notes' name='notes'>
            <Input.TextArea rows={4} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
