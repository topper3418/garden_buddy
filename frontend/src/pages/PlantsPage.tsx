import { Button, Form, Input, Modal, Popconfirm, Select, Space, Table, Typography, message } from 'antd'
import { useEffect, useState } from 'react'

import { createPlant, deletePlant, queryPlants, updatePlant } from '../api/plants'
import { listPlantTypes } from '../api/plantTypes'
import { listSpecies } from '../api/species'
import type { Plant, PlantCreate, PlantTypeListItem, SpeciesListItem } from '../types/models'

export function PlantsPage() {
  const [items, setItems] = useState<Plant[]>([])
  const [speciesOptions, setSpeciesOptions] = useState<SpeciesListItem[]>([])
  const [typeOptions, setTypeOptions] = useState<PlantTypeListItem[]>([])
  const [isModalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Plant | null>(null)
  const [nameFilter, setNameFilter] = useState('')
  const [form] = Form.useForm<PlantCreate>()

  async function refresh() {
    const data = await queryPlants({ nameContains: nameFilter || undefined, limit: 200, offset: 0 })
    setItems(data)
  }

  useEffect(() => {
    async function loadLookups() {
      const [species, types] = await Promise.all([listSpecies(200, 0), listPlantTypes(200, 0)])
      setSpeciesOptions(species.items)
      setTypeOptions(types.items)
    }

    void loadLookups()
    void refresh()
  }, [])

  async function onSubmit() {
    const values = await form.validateFields()
    const payload: PlantCreate = {
      name: values.name,
      notes: values.notes,
      species_id: values.species_id ?? null,
      plant_type_ids: values.plant_type_ids ?? [],
    }

    if (editing) {
      await updatePlant(editing.id, payload)
      message.success('Plant updated')
    } else {
      await createPlant(payload)
      message.success('Plant created')
    }

    setModalOpen(false)
    setEditing(null)
    form.resetFields()
    await refresh()
  }

  return (
    <>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>Plants</Typography.Title>
        <Space>
          <Input.Search
            placeholder='Search plant name'
            onSearch={(value) => {
              setNameFilter(value)
              void queryPlants({ nameContains: value || undefined, limit: 200, offset: 0 }).then(setItems)
            }}
            style={{ width: 240 }}
          />
          <Button type='primary' onClick={() => setModalOpen(true)}>New Plant</Button>
        </Space>
      </Space>

      <Table
        rowKey='id'
        dataSource={items}
        columns={[
          { title: 'ID', dataIndex: 'id', width: 80 },
          { title: 'Name', dataIndex: 'name' },
          { title: 'Species', render: (_, row) => row.species?.name ?? '-' },
          { title: 'Types', render: (_, row) => row.plant_types.map((item) => item.name).join(', ') || '-' },
          {
            title: 'Actions',
            render: (_, row) => (
              <Space>
                <Button
                  size='small'
                  onClick={() => {
                    setEditing(row)
                    form.setFieldsValue({
                      name: row.name,
                      notes: row.notes ?? undefined,
                      species_id: row.species_id ?? undefined,
                      plant_type_ids: row.plant_type_ids,
                    })
                    setModalOpen(true)
                  }}
                >
                  Edit
                </Button>
                <Popconfirm
                  title='Delete plant?'
                  onConfirm={async () => {
                    await deletePlant(row.id)
                    message.success('Plant deleted')
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
        title={editing ? 'Edit Plant' : 'Create Plant'}
        open={isModalOpen}
        onCancel={() => {
          setModalOpen(false)
          setEditing(null)
          form.resetFields()
        }}
        onOk={() => void onSubmit()}
        width={720}
      >
        <Form form={form} layout='vertical'>
          <Form.Item label='Name' name='name' rules={[{ required: true }]}> 
            <Input />
          </Form.Item>
          <Form.Item label='Species' name='species_id'>
            <Select
              allowClear
              options={speciesOptions.map((item) => ({ value: item.id, label: item.name }))}
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
            <Input.TextArea rows={5} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
