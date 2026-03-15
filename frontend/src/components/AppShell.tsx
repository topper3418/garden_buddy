import { AppstoreOutlined, CameraOutlined, MenuOutlined, TagsOutlined } from '@ant-design/icons'
import { Button, Drawer, Layout, Menu } from 'antd'
import type { MenuProps } from 'antd'
import { useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'

import { useIsMobile } from '../hooks/useIsMobile'
import './AppShell.css'

const { Header, Content, Sider } = Layout

const items: MenuProps['items'] = [
  { key: '/', icon: <AppstoreOutlined />, label: <Link to='/'>Dashboard</Link> },
  { key: '/species', icon: <AppstoreOutlined />, label: <Link to='/species'>Species</Link> },
  { key: '/tags', icon: <TagsOutlined />, label: <Link to='/tags'>Tags</Link> },
  { key: '/plants', icon: <AppstoreOutlined />, label: <Link to='/plants'>Plants</Link> },
  { key: '/media', icon: <CameraOutlined />, label: <Link to='/media'>Media</Link> },
]

export function AppShell() {
  const location = useLocation()
  const isMobile = useIsMobile()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const selectedKey = location.pathname.startsWith('/plants/')
    ? '/plants'
    : location.pathname.startsWith('/species/')
      ? '/species'
      : location.pathname.startsWith('/tags/')
        ? '/tags'
        : location.pathname

  const menu = (
    <Menu
      theme='dark'
      mode='inline'
      selectedKeys={[selectedKey]}
      items={items}
      onClick={() => setDrawerOpen(false)}
    />
  )

  return (
    <Layout className='app-shell'>
      {!isMobile && (
        <Sider width={240} className='app-shell__sider'>
          <div className='app-shell__brand'>Garden Buddy</div>
          {menu}
        </Sider>
      )}
      <Layout>
        {isMobile && (
          <Header className='app-shell__header'>
            <Button
              className='app-shell__mobile-menu-button'
              icon={<MenuOutlined />}
              onClick={() => setDrawerOpen(true)}
              aria-label='Open navigation menu'
            />
          </Header>
        )}
        <Content className='app-shell__content'>
          <div className='app-shell__content-card'>
            <Outlet />
          </div>
        </Content>
      </Layout>
      {isMobile && (
        <Drawer
          className='app-shell__mobile-drawer'
          title='Garden Buddy'
          placement='left'
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          width={264}
          styles={{ body: { background: '#001529' } }}
        >
          {menu}
        </Drawer>
      )}
    </Layout>
  )
}
