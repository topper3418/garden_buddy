import { lazy, Suspense } from 'react'
import { Spin } from 'antd'
import { Navigate, Route, Routes } from 'react-router-dom'

import { AppShell } from './components/AppShell'

const DashboardPage = lazy(async () => import('./pages/DashboardPage').then((module) => ({ default: module.DashboardPage })))
const SpeciesPage = lazy(async () => import('./pages/SpeciesPage').then((module) => ({ default: module.SpeciesPage })))
const PlantTypesPage = lazy(async () => import('./pages/PlantTypesPage').then((module) => ({ default: module.PlantTypesPage })))
const PlantsPage = lazy(async () => import('./pages/PlantsPage').then((module) => ({ default: module.PlantsPage })))
const PlantDetailPage = lazy(async () => import('./pages/PlantDetailPage').then((module) => ({ default: module.PlantDetailPage })))
const MediaPage = lazy(async () => import('./pages/MediaPage').then((module) => ({ default: module.MediaPage })))

function PageFallback() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 64 }}>
      <Spin size='large' />
    </div>
  )
}

function App() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path='/' element={<DashboardPage />} />
          <Route path='/species' element={<SpeciesPage />} />
          <Route path='/plant-types' element={<PlantTypesPage />} />
          <Route path='/plants' element={<PlantsPage />} />
          <Route path='/plants/:plantId' element={<PlantDetailPage />} />
          <Route path='/media' element={<MediaPage />} />
        </Route>
        <Route path='*' element={<Navigate to='/' replace />} />
      </Routes>
    </Suspense>
  )
}

export default App
