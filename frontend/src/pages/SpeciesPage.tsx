import { Button, Form, Input, Modal, Popconfirm, Space, Table, Typography, message } from 'antd'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { API_QUERY_LIMIT_MAX } from '../api/limits'
import { createSpecies, deleteSpecies, querySpecies, updateSpecies } from '../api/species'
import type { Species, SpeciesCreate } from '../types/models'

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

function collectDescendantSpeciesIds(node: SpeciesTreeNode): number[] {
  const ids: number[] = [node.id]
  if (!node.children || node.children.length === 0) {
    return ids
  }

  for (const child of node.children) {
    ids.push(...collectDescendantSpeciesIds(child))
  }

  return ids
}

export function SpeciesPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState<SpeciesTreeNode[]>([])
  const [isModalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Species | null>(null)
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
    if (editing) {
      await updateSpecies(editing.id, values)
      message.success('Species updated')
    } else {
      await createSpecies(values)
      message.success('Species created')
    }
    setModalOpen(false)
    setEditing(null)
    form.resetFields()
    await refresh()
  }

  return (
    <>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>Species</Typography.Title>
        <Button type='primary' onClick={() => setModalOpen(true)}>New Species</Button>
      </Space>

      <Table
        rowKey='id'
        dataSource={items}
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          pageSizeOptions: [10, 20, 50],
          showTotal: (total) => `${total} species`,
        }}
        expandable={{
          defaultExpandAllRows: false,
          rowExpandable: (row) => (row.children?.length ?? 0) > 0,
        }}
        columns={[
          { title: 'Name', dataIndex: 'name' },
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
          {
            title: 'Actions',
            render: (_, row) => (
              <Space>
                <Button
                  size='small'
                  onClick={() => {
                    const speciesIds = collectDescendantSpeciesIds(row)
                    const params = new URLSearchParams()
                    for (const speciesId of speciesIds) {
                      params.append('speciesIds', String(speciesId))
                    }
                    navigate(`/plants?${params.toString()}`)
                  }}
                >
                  View Plants
                </Button>
                <Button
                  size='small'
                  onClick={() => {
                    setEditing(row)
                    form.setFieldsValue({
                      name: row.name,
                      common_name: row.common_name,
                      notes: row.notes,
                      parent_species_id: row.parent_species_id,
                    })
                    setModalOpen(true)
                  }}
                >
                  Edit
                </Button>
                <Popconfirm
                  title='Delete species?'
                  onConfirm={async () => {
                    try {
                      await deleteSpecies(row.id)
                      message.success('Species deleted')
                      await refresh()
                    } catch {
                      message.error('Could not delete species (possibly has subspecies)')
                    }
                  }}
                >
                  <Button size='small' danger>Delete</Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title={editing ? 'Edit Species' : 'Create Species'}
        open={isModalOpen}
        onCancel={() => {
          setModalOpen(false)
          setEditing(null)
          form.resetFields()
        }}
        onOk={() => void onSubmit()}
      >
        <Form form={form} layout='vertical'>
          <Form.Item label='Name' name='name' rules={[{ required: true }]}>
            <Input />
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
