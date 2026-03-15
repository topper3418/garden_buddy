import { FilterOutlined } from '@ant-design/icons'
import { Button, Form, Input, InputNumber, Modal, Select, Space, Tag, TreeSelect, Typography } from 'antd'
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { API_QUERY_LIMIT_MAX, clampQueryLimit } from '../api/limits'
import { queryMedia } from '../api/media'
import { MediaCard } from '../components/MediaCard'
import { listTags } from '../api/tags'
import { querySpecies } from '../api/species'
import { useIsMobile } from '../hooks/useIsMobile'
import type { Media, TagListItem, Species } from '../types/models'

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
  const isMobile = useIsMobile()
  const [searchParams, setSearchParams] = useSearchParams()
  const [items, setItems] = useState<Media[]>([])
  const [speciesOptions, setSpeciesOptions] = useState<Species[]>([])
  const [speciesTreeOptions, setSpeciesTreeOptions] = useState<SpeciesTreeOption[]>([])
  const [tagOptions, setTagOptions] = useState<TagListItem[]>([])
  const [isFilterModalOpen, setFilterModalOpen] = useState(false)
  const [filterForm] = Form.useForm<{
    nameContains?: string
    speciesIds?: number[]
    tagId?: number
    limit?: number
    offset?: number
  }>()

  const nameContains = searchParams.get('nameContains') ?? undefined
  const speciesIds = searchParams
    .getAll('speciesIds')
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0)
  const tagId = searchParams.get('tagId') ? Number(searchParams.get('tagId')) : undefined
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
  const selectedTagLabel = tagId === undefined
    ? undefined
    : tagOptions.find((item) => item.id === tagId)?.name ?? 'Selected tag'

  async function refresh() {
    const data = await queryMedia({ nameContains, speciesIds, tagId, limit, offset, includeFilePath: true })
    setItems(data)
  }

  useEffect(() => {
    async function loadLookups() {
      const [species, types] = await Promise.all([
        querySpecies({ limit: API_QUERY_LIMIT_MAX, offset: 0 }),
        listTags(200, 0),
      ])
      setSpeciesOptions(species)
      setSpeciesTreeOptions(buildSpeciesTree(species))
      setTagOptions(types.items)
    }

    void loadLookups()
  }, [])

  useEffect(() => {
    void refresh()
  }, [nameContains, speciesIds.join(','), tagId, limit, offset])

  function setFilters(values: {
    nameContains?: string
    speciesIds?: number[]
    tagId?: number
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
    if (values.tagId !== undefined) params.set('tagId', String(values.tagId))
    if (values.limit !== undefined) params.set('limit', String(clampQueryLimit(values.limit)))
    if (values.offset !== undefined) params.set('offset', String(values.offset))

    setSearchParams(params)
  }

  return (
    <>
      <Space
        wrap
        style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}
        direction={isMobile ? 'vertical' : 'horizontal'}
      >
        <Typography.Title level={3} style={{ margin: 0 }}>Media</Typography.Title>
        <Button
          icon={<FilterOutlined />}
          onClick={() => {
            filterForm.setFieldsValue({
              nameContains,
              speciesIds,
              tagId,
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
        {selectedTagLabel && <Tag color='purple'>Tag: {selectedTagLabel}</Tag>}
        {(nameContains || speciesIds.length > 0 || tagId !== undefined || limit !== 200 || offset !== 0) && (
          <Button size='small' onClick={() => setFilters({})}>Clear Filters</Button>
        )}
      </Space>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(230px, 1fr))',
          gap: 16,
          alignContent: 'flex-start',
        }}
      >
        {items.map((item) => (
          <MediaCard
            key={item.id}
            media={item}
            mode='expand'
            onNavigateToPlant={(plantId) => navigate(`/plants/${plantId}`)}
            onRenameMedia={() => void refresh()}
          />
        ))}
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
        width={isMobile ? '100%' : 640}
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
          <Form.Item label='Tag' name='tagId'>
            <Select
              allowClear
              options={tagOptions.map((item) => ({ value: item.id, label: item.name }))}
            />
          </Form.Item>
          <Space style={{ width: '100%' }} direction={isMobile ? 'vertical' : 'horizontal'}>
            <Form.Item label='Limit' name='limit' style={{ flex: 1, width: isMobile ? '100%' : undefined }}>
              <InputNumber min={1} max={API_QUERY_LIMIT_MAX} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label='Offset' name='offset' style={{ flex: 1, width: isMobile ? '100%' : undefined }}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </>
  )
}
