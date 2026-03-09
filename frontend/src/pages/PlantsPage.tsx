import { FilterOutlined } from '@ant-design/icons'
import { Button, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Switch, Table, Tag, TreeSelect, Typography, message } from 'antd'
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { NotesEditor } from '../components/NotesEditor'
import { API_QUERY_LIMIT_MAX, clampQueryLimit } from '../api/limits'
import { createPlant, deletePlant, queryPlants, updatePlant } from '../api/plants'
import { listPlantTypes } from '../api/plantTypes'
import { querySpecies } from '../api/species'
import type { Plant, PlantCreate, PlantTypeListItem, Species } from '../types/models'

type SpeciesTreeOption = {
  title: string
  value: number
  key: number
  children?: SpeciesTreeOption[]
}

function buildSpeciesTree(species: Species[]): SpeciesTreeOption[] {
  const byId = new Map<number, SpeciesTreeOption>()

  for (const item of species) {
    byId.set(item.id, {
      title: item.common_name?.trim() || 'Unknown common name',
      value: item.id,
      key: item.id,
      children: [],
    })
  }

  const roots: SpeciesTreeOption[] = []
  for (const item of species) {
    const node = byId.get(item.id)
    if (!node) {
      continue
    }
    if (item.parent_species_id && byId.has(item.parent_species_id)) {
      byId.get(item.parent_species_id)?.children?.push(node)
    } else {
      roots.push(node)
    }
  }

  const sortNodes = (nodes: SpeciesTreeOption[]) => {
    nodes.sort((a, b) => a.title.localeCompare(b.title))
    for (const node of nodes) {
      if (node.children && node.children.length > 0) {
        sortNodes(node.children)
      }
    }
  }

  sortNodes(roots)
  return roots
}

export function PlantsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [items, setItems] = useState<Plant[]>([])
  const [speciesOptions, setSpeciesOptions] = useState<Species[]>([])
  const [speciesTreeOptions, setSpeciesTreeOptions] = useState<SpeciesTreeOption[]>([])
  const [typeOptions, setTypeOptions] = useState<PlantTypeListItem[]>([])
  const [isModalOpen, setModalOpen] = useState(false)
  const [isFilterModalOpen, setFilterModalOpen] = useState(false)
  const [editing, setEditing] = useState<Plant | null>(null)
  const [form] = Form.useForm<PlantCreate>()
  const [filterForm] = Form.useForm<{
    nameContains?: string
    speciesIds?: number[]
    plantTypeId?: number
    archived?: boolean
    limit?: number
    offset?: number
  }>()

  const nameContains = searchParams.get('nameContains') ?? undefined
  const speciesIds = searchParams
    .getAll('speciesIds')
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0)
  const plantTypeId = searchParams.get('plantTypeId') ? Number(searchParams.get('plantTypeId')) : undefined
  const archived = searchParams.get('archived') === 'true'
  const limit = clampQueryLimit(searchParams.get('limit') ? Number(searchParams.get('limit')) : API_QUERY_LIMIT_MAX)
  const offset = searchParams.get('offset') ? Number(searchParams.get('offset')) : 0
  const selectedSpeciesLabels = speciesIds
    .map((speciesId) => {
      const species = speciesOptions.find((item) => item.id === speciesId)
      if (!species) {
        return 'Selected species'
      }
      return species.common_name?.trim() || 'Unknown common name'
    })
    .slice(0, 4)
  const selectedPlantTypeLabel = plantTypeId === undefined
    ? undefined
    : typeOptions.find((item) => item.id === plantTypeId)?.name ?? 'Selected type'
  const speciesSelectOptions = speciesOptions.map((item) => ({
    value: item.id,
    label: item.common_name?.trim() || 'Unknown common name',
  }))

  async function refresh() {
    const data = await queryPlants({ nameContains, speciesIds, plantTypeId, archived, limit, offset })
    setItems(data)
  }

  useEffect(() => {
    async function loadLookups() {
      const [species, types] = await Promise.all([
        querySpecies({ limit: API_QUERY_LIMIT_MAX, offset: 0 }),
        listPlantTypes(200, 0),
      ])
      setSpeciesOptions(species)
      setSpeciesTreeOptions(buildSpeciesTree(species))
      setTypeOptions(types.items)
    }

    void loadLookups()
  }, [])

  useEffect(() => {
    void refresh()
  }, [nameContains, speciesIds.join(','), plantTypeId, archived, limit, offset])

  function setFilters(values: {
    nameContains?: string
    speciesIds?: number[]
    plantTypeId?: number
    archived?: boolean
    limit?: number
    offset?: number
  }) {
    const params = new URLSearchParams()

    if (values.nameContains) params.set('nameContains', values.nameContains)
    if (values.speciesIds && values.speciesIds.length > 0) {
      for (const speciesId of values.speciesIds) {
        params.append('speciesIds', String(speciesId))
      }
    }
    if (values.plantTypeId !== undefined) params.set('plantTypeId', String(values.plantTypeId))
    if (values.archived !== undefined) params.set('archived', String(values.archived))
    if (values.limit !== undefined) params.set('limit', String(clampQueryLimit(values.limit)))
    if (values.offset !== undefined) params.set('offset', String(values.offset))

    setSearchParams(params)
  }

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
          <Button
            icon={<FilterOutlined />}
            onClick={() => {
              filterForm.setFieldsValue({
                nameContains,
                speciesIds,
                plantTypeId,
                archived,
                limit,
                offset,
              })
              setFilterModalOpen(true)
            }}
          >
            Filters
          </Button>
          <Button type='primary' onClick={() => setModalOpen(true)}>New Plant</Button>
        </Space>
      </Space>

      <Space wrap style={{ marginBottom: 16 }}>
        {nameContains && <Tag color='green'>Name: {nameContains}</Tag>}
        {selectedSpeciesLabels.length > 0 && (
          <Tag color='blue'>Species: {selectedSpeciesLabels.join(', ')}{speciesIds.length > 4 ? '...' : ''}</Tag>
        )}
        {selectedPlantTypeLabel && <Tag color='purple'>Type: {selectedPlantTypeLabel}</Tag>}
        <Tag color={archived ? 'gold' : 'green'}>Status: {archived ? 'Archived' : 'Active'}</Tag>
        {(nameContains || speciesIds.length > 0 || plantTypeId !== undefined || archived || limit !== 200 || offset !== 0) && (
          <Button size='small' onClick={() => setFilters({})}>Clear Filters</Button>
        )}
      </Space>

      <Table
        rowKey='id'
        dataSource={items}
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          pageSizeOptions: [10, 20, 50],
          showTotal: (total) => `${total} plants`,
        }}
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
          { title: 'Species', render: (_, row) => row.species?.name ?? '-' },
          { title: 'Types', render: (_, row) => row.plant_types.map((item) => item.name).join(', ') || '-' },
          {
            title: 'Actions',
            render: (_, row) => (
              <Space>
                <Button
                  size='small'
                  onClick={(event) => {
                    event.stopPropagation()
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
                  <Button size='small' danger onClick={(event) => event.stopPropagation()}>Delete</Button>
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
              options={speciesSelectOptions}
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
            <NotesEditor height={260} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title='Filter Plants'
        open={isFilterModalOpen}
        onCancel={() => setFilterModalOpen(false)}
        onOk={async () => {
          const values = await filterForm.validateFields()
          setFilters(values)
          setFilterModalOpen(false)
        }}
      >
        <Form form={filterForm} layout='vertical'>
          <Form.Item label='Name Contains' name='nameContains'>
            <Input />
          </Form.Item>
          <Form.Item label='Species' name='speciesIds'>
            <TreeSelect
              treeData={speciesTreeOptions}
              treeCheckable
              showCheckedStrategy={TreeSelect.SHOW_PARENT}
              placeholder='Select one or more species'
              allowClear
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Form.Item label='Plant Type' name='plantTypeId'>
            <Select
              allowClear
              options={typeOptions.map((item) => ({ value: item.id, label: item.name }))}
            />
          </Form.Item>
          <Form.Item label='Show Archived' name='archived' valuePropName='checked'>
            <Switch />
          </Form.Item>
          <Space style={{ width: '100%' }}>
            <Form.Item label='Limit' name='limit' style={{ flex: 1 }}>
              <InputNumber min={1} max={API_QUERY_LIMIT_MAX} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label='Offset' name='offset' style={{ flex: 1 }}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </>
  )
}
