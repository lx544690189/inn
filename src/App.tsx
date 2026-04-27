import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import RoleplayPage from './pages/roleplay'

function App() {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#b86b3d',
          colorInfo: '#b86b3d',
          colorBgLayout: '#f8efe7',
          colorText: '#2b211b',
          borderRadius: 8,
          fontFamily:
            "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        },
        components: {
          Button: {
            controlHeight: 36,
          },
          Modal: {
            borderRadiusLG: 8,
          },
          Drawer: {
            borderRadiusLG: 8,
          },
        },
      }}
    >
      <RoleplayPage />
    </ConfigProvider>
  )
}

export default App
