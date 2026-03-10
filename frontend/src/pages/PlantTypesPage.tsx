import { Button, Form, Input, Modal, Popconfirm, Space, Table, Typography, message } from 'antd'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { createPlantType, deletePlantType, listPlantTypes, updatePlantType } from '../api/plantTypes'
import { useIsMobile } from '../hooks/useIsMobile'
import type { PlantType, PlantTypeCreate, PlantTypeListItem } from '../types/models'

export function PlantTypesPage() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [items, setItems] = useState<PlantTypeListItem[]>([])
  const [isModalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<PlantType | null>(null)
  const [form] = Form.useForm<PlantTypeCreate>()

  async function refresh() {
    const data = await listPlantTypes(200, 0)
    setItems(data.items)
  }

  useEffect(() => {
    void refresh()
  }, [])

  async function onSubmit() {
    const values = await form.validateFields()
    if (editing) {
      await updatePlantType(editing.id, values)
      message.success('Plant type updated')
    } else {
      await createPlantType(values)
      message.success('Plant type created')
    }
    setModalOpen(false)
    setEditing(null)
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
        <Typography.Title level={3} style={{ margin: 0 }}>Plant Types</Typography.Title>
        <Button type='primary' onClick={() => setModalOpen(true)}>New Plant Type</Button>
      </Space>

      <Table
        rowKey='id'
        dataSource={items}
        size={isMobile ? 'small' : 'middle'}
        scroll={{ x: 640 }}
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          pageSizeOptions: [10, 20, 50],
          showTotal: (total) => `${total} plant types`,
        }}
        columns={[
          { title: 'Name', dataIndex: 'name' },
          {
            title: 'Actions',
            render: (_, row) => (
              <Space wrap>
                <Button size='small' onClick={() => navigate(`/plants?plantTypeId=${row.id}`)}>
                  View Plants
                </Button>
                <Button
                  size='small'
                  onClick={() => {
                    setEditing(row as PlantType)
                    form.setFieldsValue({ name: row.name })
                    setModalOpen(true)
                  }}
                >
                  Edit
                </Button>
                <Popconfirm
                  title='Delete plant type?'
                  onConfirm={async () => {
                    await deletePlantType(row.id)
                    message.success('Plant type deleted')
                    await refresh()
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
        title={editing ? 'Edit Plant Type' : 'Create Plant Type'}
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
          <Form.Item label='Notes' name='notes'>
            <Input.TextArea rows={4} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
