import { AppstoreOutlined, CameraOutlined, TagsOutlined } from '@ant-design/icons'
import { Layout, Menu, Typography } from 'antd'
import type { MenuProps } from 'antd'
import { Link, Outlet, useLocation } from 'react-router-dom'

const { Header, Content, Sider } = Layout

const items: MenuProps['items'] = [
  { key: '/', icon: <AppstoreOutlined />, label: <Link to='/'>Dashboard</Link> },
  { key: '/species', icon: <AppstoreOutlined />, label: <Link to='/species'>Species</Link> },
  { key: '/plant-types', icon: <TagsOutlined />, label: <Link to='/plant-types'>Plant Types</Link> },
  { key: '/plants', icon: <AppstoreOutlined />, label: <Link to='/plants'>Plants</Link> },
  { key: '/media', icon: <CameraOutlined />, label: <Link to='/media'>Media</Link> },
]

export function AppShell() {
  const location = useLocation()

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={240}>
        <div style={{ padding: 16, color: '#fff', fontSize: 18, fontWeight: 600 }}>Garden Buddy</div>
        <Menu theme='dark' mode='inline' selectedKeys={[location.pathname]} items={items} />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: '0 20px' }}>
          <Typography.Title level={4} style={{ margin: 0, lineHeight: '64px' }}>
            API Control Panel
          </Typography.Title>
        </Header>
        <Content style={{ margin: 16 }}>
          <div style={{ background: '#fff', minHeight: 'calc(100vh - 112px)', padding: 16, borderRadius: 8 }}>
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  )
}
