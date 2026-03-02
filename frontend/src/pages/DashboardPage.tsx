import { Card, Col, Row, Statistic, Typography } from 'antd'
import { useEffect, useState } from 'react'

import { listMedia } from '../api/media'
import { listPlants } from '../api/plants'
import { listPlantTypes } from '../api/plantTypes'
import { listSpecies } from '../api/species'

export function DashboardPage() {
  const [counts, setCounts] = useState({ species: 0, plantTypes: 0, plants: 0, media: 0 })

  useEffect(() => {
    async function load() {
      const [species, plantTypes, plants, media] = await Promise.all([
        listSpecies(200, 0),
        listPlantTypes(200, 0),
        listPlants(200, 0),
        listMedia(200, 0),
      ])

      setCounts({
        species: species.items.length,
        plantTypes: plantTypes.items.length,
        plants: plants.items.length,
        media: media.items.length,
      })
    }

    void load()
  }, [])

  return (
    <>
      <Typography.Title level={3}>Dashboard</Typography.Title>
      <Row gutter={16}>
        <Col span={6}>
          <Card><Statistic title='Species' value={counts.species} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title='Plant Types' value={counts.plantTypes} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title='Plants' value={counts.plants} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title='Media Items' value={counts.media} /></Card>
        </Col>
      </Row>
    </>
  )
}
