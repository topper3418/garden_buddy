import { FilterOutlined } from '@ant-design/icons'
import { Button, Form, Input, InputNumber, Modal, Select, Space, Tag, TreeSelect, Typography } from 'antd'
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { API_QUERY_LIMIT_MAX, clampQueryLimit } from '../api/limits'
import { queryMedia } from '../api/media'
import { MediaCard } from '../components/MediaCard'
import { listPlantTypes } from '../api/plantTypes'
import { querySpecies } from '../api/species'
import type { Media, PlantTypeListItem, Species } from '../types/models'

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

export function MediaPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [items, setItems] = useState<Media[]>([])
  const [speciesOptions, setSpeciesOptions] = useState<Species[]>([])
  const [speciesTreeOptions, setSpeciesTreeOptions] = useState<SpeciesTreeOption[]>([])
  const [typeOptions, setTypeOptions] = useState<PlantTypeListItem[]>([])
  const [isFilterModalOpen, setFilterModalOpen] = useState(false)
  const [filterForm] = Form.useForm<{
    nameContains?: string
    speciesIds?: number[]
    plantTypeId?: number
    limit?: number
    offset?: number
  }>()

  const nameContains = searchParams.get('nameContains') ?? undefined
  const speciesIds = searchParams
    .getAll('speciesIds')
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0)
  const plantTypeId = searchParams.get('plantTypeId') ? Number(searchParams.get('plantTypeId')) : undefined
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

  async function refresh() {
    const data = await queryMedia({ nameContains, speciesIds, plantTypeId, limit, offset, includeFilePath: true })
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
  }, [nameContains, speciesIds.join(','), plantTypeId, limit, offset])

  function setFilters(values: {
    nameContains?: string
    speciesIds?: number[]
    plantTypeId?: number
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
    if (values.limit !== undefined) params.set('limit', String(clampQueryLimit(values.limit)))
    if (values.offset !== undefined) params.set('offset', String(values.offset))

    setSearchParams(params)
  }

  return (
    <>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>Media</Typography.Title>
        <Button
          icon={<FilterOutlined />}
          onClick={() => {
            filterForm.setFieldsValue({
              nameContains,
              speciesIds,
              plantTypeId,
              limit,
              offset,
            })
            setFilterModalOpen(true)
          }}
        >
          Filters
        </Button>
      </Space>

      <Space wrap style={{ marginBottom: 16 }}>
        {nameContains && <Tag color='green'>Name: {nameContains}</Tag>}
        {selectedSpeciesLabels.length > 0 && (
          <Tag color='blue'>Species: {selectedSpeciesLabels.join(', ')}{speciesIds.length > 4 ? '...' : ''}</Tag>
        )}
        {selectedPlantTypeLabel && <Tag color='purple'>Type: {selectedPlantTypeLabel}</Tag>}
        {(nameContains || speciesIds.length > 0 || plantTypeId !== undefined || limit !== 200 || offset !== 0) && (
          <Button size='small' onClick={() => setFilters({})}>Clear Filters</Button>
        )}
      </Space>

      <div style={{ maxHeight: 'calc(100vh - 280px)', overflowY: 'auto', paddingRight: 8 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignContent: 'flex-start' }}>
          {items.map((item) => (
            <MediaCard
              key={item.id}
              media={item}
              mode='navigate'
              onNavigateToPlant={(plantId) => navigate(`/plants/${plantId}`)}
            />
          ))}
        </div>
      </div>

      <Modal
        title='Filter Media'
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
