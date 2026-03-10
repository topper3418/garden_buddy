import { Card, Col, List, Row, Space, Statistic, Typography } from 'antd'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { listMedia, queryMedia } from '../api/media'
import { MediaCard } from '../components/MediaCard'
import { listPlants, queryPlants } from '../api/plants'
import { listPlantTypes } from '../api/plantTypes'
import { listSpecies } from '../api/species'
import { useIsMobile } from '../hooks/useIsMobile'
import type { Media, Plant } from '../types/models'

export function DashboardPage() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [counts, setCounts] = useState({ species: 0, plantTypes: 0, plants: 0, media: 0 })
  const [recentMedia, setRecentMedia] = useState<Media[]>([])
  const [recentPlants, setRecentPlants] = useState<Plant[]>([])

  useEffect(() => {
    async function load() {
      const [species, plantTypes, plantsList, mediaList, recentPlantsData, recentMediaData] = await Promise.all([
        listSpecies(200, 0),
        listPlantTypes(200, 0),
        listPlants(200, 0, false),
        listMedia(200, 0, false),
        queryPlants({ limit: 10, offset: 0, archived: false }),
        queryMedia({ limit: 8, offset: 0 }),
      ])

      setCounts({
        species: species.items.length,
        plantTypes: plantTypes.items.length,
        plants: plantsList.items.length,
        media: mediaList.items.length,
      })
      setRecentPlants(recentPlantsData.slice(0, 6))
      setRecentMedia(recentMediaData.slice(0, 8))
    }

    void load()
  }, [])

  return (
    <>
      <Typography.Title level={3}>Dashboard</Typography.Title>
      <Row gutter={[12, 12]}>
        <Col xs={12} sm={12} md={6}>
          <Card><Statistic title='Species' value={counts.species} /></Card>
        </Col>
        <Col xs={12} sm={12} md={6}>
          <Card><Statistic title='Plant Types' value={counts.plantTypes} /></Card>
        </Col>
        <Col xs={12} sm={12} md={6}>
          <Card><Statistic title='Plants' value={counts.plants} /></Card>
        </Col>
        <Col xs={12} sm={12} md={6}>
          <Card><Statistic title='Media Items' value={counts.media} /></Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card title='Most Recently Updated Plants' styles={{ body: { maxHeight: isMobile ? 360 : 420, overflowY: 'auto' } }}>
            <List
              dataSource={recentPlants}
              renderItem={(item) => (
                <List.Item>
                  <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                    <Typography.Link onClick={() => navigate(`/plants/${item.id}`)}>{item.name}</Typography.Link>
                    <Typography.Text type='secondary'>{new Date(item.created_at).toLocaleDateString()}</Typography.Text>
                  </Space>
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title='Most Recent Photos' styles={{ body: { maxHeight: isMobile ? 380 : 420, overflowY: 'auto' } }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignContent: 'flex-start' }}>
              {recentMedia.map((item) => (
                <MediaCard
                  key={item.id}
                  media={item}
                  mode='navigate'
                  onNavigateToPlant={(plantId) => navigate(`/plants/${plantId}`)}
                />
              ))}
            </div>
          </Card>
        </Col>
      </Row>
    </>
  )
}
