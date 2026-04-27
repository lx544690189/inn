import { Button, Card, Space, Typography } from 'antd'
import './App.css'

function App() {
  return (
    <div className="app-container">
      <Card className="app-card" title="Vite + TypeScript + Ant Design">
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Typography.Paragraph>
            项目已创建完成，你现在可以基于 Ant Design 快速开发页面。
          </Typography.Paragraph>
          <Button type="primary">开始开发</Button>
        </Space>
      </Card>
    </div>
  )
}

export default App
