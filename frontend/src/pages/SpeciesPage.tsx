import { EllipsisOutlined } from '@ant-design/icons'
import { Button, Dropdown, Form, Input, Modal, Popconfirm, Space, Table, Typography, message } from 'antd'
import type { MenuProps, TableProps } from 'antd'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { API_QUERY_LIMIT_MAX } from '../api/limits'
import { createSpecies, deleteSpecies, querySpecies, updateSpecies } from '../api/species'
import { useIsMobile } from '../hooks/useIsMobile'
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
  const isMobile = useIsMobile()
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

  const viewPlants = (row: SpeciesTreeNode) => {
    const speciesIds = collectDescendantSpeciesIds(row)
    const params = new URLSearchParams()
    for (const speciesId of speciesIds) {
      params.append('speciesIds', String(speciesId))
    }
    navigate(`/plants?${params.toString()}`)
  }

  const openEditModal = (row: SpeciesTreeNode) => {
    setEditing(row)
    form.setFieldsValue({
      name: row.name,
      common_name: row.common_name,
      notes: row.notes,
      parent_species_id: row.parent_species_id,
    })
    setModalOpen(true)
  }

  const deleteRow = async (row: SpeciesTreeNode) => {
    try {
      await deleteSpecies(row.id)
      message.success('Species deleted')
      await refresh()
    } catch {
      message.error('Could not delete species (possibly has subspecies)')
    }
  }

  const mobileColumns: TableProps<SpeciesTreeNode>['columns'] = [
    {
      title: 'Species',
      render: (_, row) => (
        <div style={{ lineHeight: 1.25 }}>
          <Typography.Text strong style={{ display: 'block', wordBreak: 'break-word' }}>
            {row.name}
          </Typography.Text>
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
    {
      title: '',
      width: 46,
      align: 'center',
      render: (_, row) => {
        const menuItems: MenuProps['items'] = [
          { key: 'view', label: 'View Plants' },
          { key: 'edit', label: 'Edit' },
          { key: 'delete', label: 'Delete', danger: true },
        ]

        return (
          <Dropdown
            trigger={['click']}
            menu={{
              items: menuItems,
              onClick: ({ key }) => {
                if (key === 'view') {
                  viewPlants(row)
                  return
                }
                if (key === 'edit') {
                  openEditModal(row)
                  return
                }
                if (key === 'delete') {
                  void Modal.confirm({
                    title: 'Delete species?',
                    content: 'This may fail if the species has subspecies or references.',
                    okText: 'Delete',
                    okButtonProps: { danger: true },
                    onOk: async () => deleteRow(row),
                  })
                }
              },
            }}
          >
            <Button size='small' icon={<EllipsisOutlined />} aria-label='Species row actions' />
          </Dropdown>
        )
      },
    },
  ]

  const desktopColumns: TableProps<SpeciesTreeNode>['columns'] = [
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
        <Space wrap>
          <Button size='small' onClick={() => viewPlants(row)}>
            View Plants
          </Button>
          <Button size='small' onClick={() => openEditModal(row)}>
            Edit
          </Button>
          <Popconfirm title='Delete species?' onConfirm={async () => deleteRow(row)}>
            <Button size='small' danger>Delete</Button>
          </Popconfirm>
        </Space>
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
        <Typography.Title level={3} style={{ margin: 0 }}>Species</Typography.Title>
        <Button type='primary' onClick={() => setModalOpen(true)}>New Species</Button>
      </Space>

      <Table
        rowKey='id'
        dataSource={items}
        size={isMobile ? 'small' : 'middle'}
        scroll={isMobile ? undefined : { x: 860 }}
        tableLayout={isMobile ? 'fixed' : undefined}
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
