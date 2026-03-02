import { Button, Form, Input, Modal, Popconfirm, Space, Table, Typography, message } from 'antd'
import { useEffect, useState } from 'react'

import { createSpecies, deleteSpecies, listSpecies, updateSpecies } from '../api/species'
import type { Species, SpeciesCreate, SpeciesListItem } from '../types/models'

export function SpeciesPage() {
  const [items, setItems] = useState<SpeciesListItem[]>([])
  const [isModalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Species | null>(null)
  const [form] = Form.useForm<SpeciesCreate>()

  async function refresh() {
    const data = await listSpecies(200, 0)
    setItems(data.items)
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
        columns={[
          { title: 'ID', dataIndex: 'id', width: 80 },
          { title: 'Name', dataIndex: 'name' },
          { title: 'Common Name', dataIndex: 'common_name' },
          {
            title: 'Actions',
            render: (_, row) => (
              <Space>
                <Button
                  size='small'
                  onClick={() => {
                    setEditing(row as Species)
                    form.setFieldsValue({
                      name: row.name,
                      common_name: row.common_name,
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
