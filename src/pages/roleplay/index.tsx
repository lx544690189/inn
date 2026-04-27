import {
  AssistantRuntimeProvider,
  ComposerPrimitive,
  MessagePartPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  type AppendMessage,
  type ExternalStoreAdapter,
  type MessageStatus,
  type ThreadMessageLike,
  useExternalStoreRuntime,
} from '@assistant-ui/react'
import {
  Button,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  List,
  Modal,
  Popconfirm,
  Segmented,
  Space,
  Spin,
  Switch,
  Typography,
} from 'antd'
import classNames from 'classnames'
import { useEffect } from 'react'
import { useSnapshot } from 'valtio'
import { roleplayStore } from '../../stores/roleplay-store'
import type { ChatMessage, ChatMessageStatus, ModelConfig } from '../../types/storage'
import styles from './index.module.less'

const { Text, Title } = Typography

const textPartComponents = {
  Text: () => <MessagePartPrimitive.Text component="span" />,
}

const statusToAssistantStatus = (
  status: ChatMessageStatus,
): MessageStatus | undefined => {
  if (status === 'streaming' || status === 'pending') {
    return { type: 'running' }
  }

  if (status === 'completed') {
    return { type: 'complete', reason: 'stop' }
  }

  if (status === 'cancelled') {
    return { type: 'incomplete', reason: 'cancelled' }
  }

  if (status === 'failed') {
    return { type: 'incomplete', reason: 'error' }
  }

  return undefined
}

const toThreadMessage = (message: ChatMessage): ThreadMessageLike => ({
  id: message.id,
  role: message.role,
  content: message.content,
  createdAt: new Date(message.createdAt),
  status: statusToAssistantStatus(message.status),
  metadata: {
    custom: {
      storageStatus: message.status,
    },
  },
})

const readAppendMessageText = (message: AppendMessage) => {
  if (typeof message.content === 'string') {
    return message.content
  }

  return message.content
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('')
}

function UserMessage() {
  return (
    <MessagePrimitive.Root className={styles.userMessage}>
      <div className={styles.userBubble}>
        <MessagePrimitive.Parts components={textPartComponents} />
      </div>
    </MessagePrimitive.Root>
  )
}

function AssistantMessage() {
  return (
    <MessagePrimitive.Root className={styles.assistantMessage}>
      <div className={styles.assistantAvatar}>AI</div>
      <div className={styles.assistantBubble}>
        <MessagePrimitive.Parts components={textPartComponents} />
      </div>
    </MessagePrimitive.Root>
  )
}

function ChatRuntimeProvider({ children }: { children: React.ReactNode }) {
  const snap = useSnapshot(roleplayStore, { sync: true })
  const messages = [...snap.messages] as ChatMessage[]
  const adapter: ExternalStoreAdapter<ChatMessage> = {
    messages,
    isRunning: snap.running,
    isDisabled: !snap.activeCharacterId || snap.loading,
    onNew: async (message) => {
      await roleplayStore.sendUserMessage(readAppendMessageText(message))
    },
    onCancel: async () => {
      roleplayStore.cancelRun()
    },
    convertMessage: toThreadMessage,
    unstable_capabilities: {
      copy: true,
    },
  }
  const runtime = useExternalStoreRuntime(adapter)

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  )
}

function ChatPanel() {
  const snap = useSnapshot(roleplayStore, { sync: true })
  const activeCharacter = snap.characters.find(
    (item) => item.id === snap.activeCharacterId,
  )

  if (!activeCharacter) {
    return (
      <div className={styles.emptyPanel}>
        <Empty
          description="创建一个角色卡，开始第一段剧情"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        >
          <Button type="primary" onClick={() => roleplayStore.openCreateCharacterModal()}>
            新建角色
          </Button>
        </Empty>
      </div>
    )
  }

  return (
    <ChatRuntimeProvider>
      <ThreadPrimitive.Root className={styles.threadRoot}>
        <ThreadPrimitive.Viewport className={styles.threadViewport}>
          <ThreadPrimitive.Empty>
            <div className={styles.openingState}>
              <Title level={4}>{activeCharacter.name}</Title>
              <Text type="secondary">{activeCharacter.openingMessage}</Text>
            </div>
          </ThreadPrimitive.Empty>
          <ThreadPrimitive.Messages
            components={{
              UserMessage,
              AssistantMessage,
            }}
          />
          <ThreadPrimitive.ViewportFooter className={styles.composerFooter}>
            {snap.error ? <div className={styles.errorText}>{snap.error}</div> : null}
            <ComposerPrimitive.Root className={styles.composer}>
              <ComposerPrimitive.Input
                className={styles.composerInput}
                placeholder={
                  snap.activeThreadId ? '输入你的回复...' : '输入后将自动创建会话...'
                }
                submitMode="enter"
              />
              {snap.running ? (
                <ComposerPrimitive.Cancel className={styles.iconButton}>
                  停止
                </ComposerPrimitive.Cancel>
              ) : (
                <ComposerPrimitive.Send className={styles.sendButton}>
                  发送
                </ComposerPrimitive.Send>
              )}
            </ComposerPrimitive.Root>
          </ThreadPrimitive.ViewportFooter>
        </ThreadPrimitive.Viewport>
      </ThreadPrimitive.Root>
    </ChatRuntimeProvider>
  )
}

function Sidebar() {
  const snap = useSnapshot(roleplayStore)

  return (
    <aside className={styles.sidebar}>
      <div className={styles.sidebarHeader}>
        <div>
          <Title level={3}>Inn</Title>
          <Text type="secondary">角色叙事工作台</Text>
        </div>
        <Button type="primary" onClick={() => roleplayStore.openCreateCharacterModal()}>
          新建角色
        </Button>
      </div>

      <div className={styles.sidebarSection}>
        <div className={styles.sectionTitle}>角色卡</div>
        <List
          dataSource={[...snap.characters]}
          locale={{ emptyText: '暂无角色' }}
          renderItem={(character) => (
            <List.Item
              className={classNames(styles.characterItem, {
                [styles.activeItem]: character.id === snap.activeCharacterId,
              })}
              onClick={() => void roleplayStore.selectCharacter(character.id)}
            >
              <List.Item.Meta
                title={character.name}
                description={character.description || character.background}
              />
              <Space>
                <Button
                  size="small"
                  onClick={(event) => {
                    event.stopPropagation()
                    roleplayStore.openEditCharacterModal(character.id)
                  }}
                >
                  编辑
                </Button>
                <Popconfirm
                  title="删除角色"
                  description="会同时删除该角色下的会话和记忆。"
                  onConfirm={(event) => {
                    event?.stopPropagation()
                    void roleplayStore.deleteCharacter(character.id)
                  }}
                >
                  <Button
                    danger
                    size="small"
                    onClick={(event) => event.stopPropagation()}
                  >
                    删除
                  </Button>
                </Popconfirm>
              </Space>
            </List.Item>
          )}
        />
      </div>

      <div className={styles.sidebarSection}>
        <div className={styles.sectionTitleRow}>
          <span>会话</span>
          <Button
            size="small"
            disabled={!snap.activeCharacterId}
            onClick={() => void roleplayStore.createThread()}
          >
            新建
          </Button>
        </div>
        <List
          dataSource={[...snap.threads]}
          locale={{ emptyText: '暂无会话' }}
          renderItem={(thread) => (
            <List.Item
              className={classNames(styles.threadItem, {
                [styles.activeItem]: thread.id === snap.activeThreadId,
              })}
              onClick={() => void roleplayStore.selectThread(thread.id)}
            >
              <Text ellipsis>{thread.title}</Text>
              <Popconfirm
                title="删除会话"
                description="会同时删除该会话的消息和记忆摘要。"
                onConfirm={(event) => {
                  event?.stopPropagation()
                  void roleplayStore.deleteThread(thread.id)
                }}
              >
                <Button
                  danger
                  size="small"
                  type="text"
                  onClick={(event) => event.stopPropagation()}
                >
                  删除
                </Button>
              </Popconfirm>
            </List.Item>
          )}
        />
      </div>
    </aside>
  )
}

function HeaderBar() {
  const snap = useSnapshot(roleplayStore)
  const activeCharacter = snap.characters.find(
    (item) => item.id === snap.activeCharacterId,
  )
  const activeConfig = snap.modelConfigs.find(
    (item) => item.id === snap.activeModelConfigId,
  )

  return (
    <header className={styles.headerBar}>
      <div>
        <Title level={4}>{activeCharacter?.name || '未选择角色'}</Title>
        <Text type="secondary">
          {activeConfig?.model || '未配置模型'} · 最近
          {snap.memoryConfig.recentRounds}轮 ·
          {snap.memorySummary ? ' 已有长期记忆' : ' 暂无长期记忆'}
        </Text>
      </div>
      <Space>
        <Button onClick={() => roleplayStore.setMemoryDrawerOpen(true)}>
          记忆
        </Button>
        <Button onClick={() => roleplayStore.setModelDrawerOpen(true)}>
          模型配置
        </Button>
      </Space>
    </header>
  )
}

function CharacterModal() {
  const [form] = Form.useForm()
  const snap = useSnapshot(roleplayStore, { sync: true })
  const activeCharacter = snap.characters.find(
    (item) => item.id === snap.characterModal.characterId,
  )

  useEffect(() => {
    if (!snap.characterModal.open) {
      return
    }

    form.setFieldsValue(
      activeCharacter ?? {
        name: '',
        background: '',
        description: '',
        openingMessage: '',
      },
    )
  }, [activeCharacter, form, snap.characterModal.open])

  return (
    <Modal
      title={activeCharacter ? '编辑角色卡' : '新建角色卡'}
      open={snap.characterModal.open}
      okText="保存"
      cancelText="取消"
      onCancel={() => roleplayStore.closeCharacterModal()}
      onOk={() => form.submit()}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={(values) => void roleplayStore.saveCharacter(values)}
      >
        <Form.Item
          name="name"
          label="角色名"
          rules={[{ required: true, message: '请输入角色名' }]}
        >
          <Input placeholder="例如：温柔的旅店老板" />
        </Form.Item>
        <Form.Item name="background" label="背景设定">
          <Input.TextArea rows={3} placeholder="角色所在世界、关系、处境..." />
        </Form.Item>
        <Form.Item name="description" label="角色描述">
          <Input.TextArea rows={3} placeholder="性格、说话方式、行为边界..." />
        </Form.Item>
        <Form.Item
          name="openingMessage"
          label="开场白"
          rules={[{ required: true, message: '请输入开场白' }]}
        >
          <Input.TextArea rows={4} placeholder="第一句会由角色说出的话..." />
        </Form.Item>
      </Form>
    </Modal>
  )
}

function ModelConfigDrawer() {
  const [form] = Form.useForm()
  const snap = useSnapshot(roleplayStore, { sync: true })
  const activeConfig = snap.modelConfigs.find(
    (item) => item.id === snap.activeModelConfigId,
  )

  useEffect(() => {
    if (!snap.modelDrawerOpen || !activeConfig) {
      return
    }

    form.setFieldsValue({
      ...activeConfig,
      apiKey: snap.activeApiKey,
    })
  }, [activeConfig, form, snap.activeApiKey, snap.modelDrawerOpen])

  return (
    <Drawer
      title="模型配置"
      open={snap.modelDrawerOpen}
      width={420}
      onClose={() => roleplayStore.setModelDrawerOpen(false)}
      extra={
        <Button type="primary" onClick={() => form.submit()}>
          保存
        </Button>
      }
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={(values: ModelConfig & { apiKey: string }) =>
          void roleplayStore.saveModelConfig(values)
        }
      >
        <Form.Item name="id" hidden>
          <Input />
        </Form.Item>
        <Form.Item name="provider" label="供应商">
          <Segmented
            options={[
              {
                label: '硅基流动',
                value: 'siliconflow',
              },
            ]}
          />
        </Form.Item>
        <Form.Item name="name" label="配置名称">
          <Input />
        </Form.Item>
        <Form.Item
          name="apiKey"
          label="API Key"
          extra="密钥仅保存在当前浏览器本地。正式分发时建议改为后端代理。"
        >
          <Input.Password placeholder="sk-..." />
        </Form.Item>
        <Form.Item name="baseUrl" label="Base URL">
          <Input />
        </Form.Item>
        <Form.Item name="model" label="模型">
          <Input placeholder="Qwen/Qwen3-32B" />
        </Form.Item>
        <Form.Item name="temperature" label="Temperature">
          <InputNumber min={0} max={2} step={0.1} className={styles.fullWidth} />
        </Form.Item>
        <Form.Item name="topP" label="Top P">
          <InputNumber min={0} max={1} step={0.05} className={styles.fullWidth} />
        </Form.Item>
        <Form.Item name="maxTokens" label="Max Tokens">
          <InputNumber min={128} max={32768} step={128} className={styles.fullWidth} />
        </Form.Item>
        <Form.Item name="enableThinking" label="启用 Thinking" valuePropName="checked">
          <Switch />
        </Form.Item>
      </Form>
    </Drawer>
  )
}

function MemoryDrawer() {
  const snap = useSnapshot(roleplayStore, { sync: true })

  return (
    <Drawer
      title="记忆"
      open={snap.memoryDrawerOpen}
      width={420}
      onClose={() => roleplayStore.setMemoryDrawerOpen(false)}
    >
      <Space direction="vertical" size="large" className={styles.fullWidth}>
        <div>
          <Text strong>长期摘要</Text>
          <div className={styles.memoryBox}>
            {snap.memorySummary || '对话轮次达到阈值后会自动生成摘要。'}
          </div>
        </div>
        <Space direction="vertical" className={styles.fullWidth}>
          <Text strong>最近上下文轮数</Text>
          <InputNumber
            min={2}
            max={50}
            value={snap.memoryConfig.recentRounds}
            className={styles.fullWidth}
            onChange={(value) => {
              roleplayStore.memoryConfig.recentRounds = value ?? 12
            }}
          />
        </Space>
        <Space direction="vertical" className={styles.fullWidth}>
          <Text strong>自动总结触发轮数</Text>
          <InputNumber
            min={4}
            max={100}
            value={snap.memoryConfig.summaryTriggerRounds}
            className={styles.fullWidth}
            onChange={(value) => {
              roleplayStore.memoryConfig.summaryTriggerRounds = value ?? 24
            }}
          />
        </Space>
      </Space>
    </Drawer>
  )
}

export default function RoleplayPage() {
  const snap = useSnapshot(roleplayStore)

  useEffect(() => {
    void roleplayStore.init()
  }, [])

  return (
    <div className={styles.page}>
      <Sidebar />
      <main className={styles.main}>
        <HeaderBar />
        <section className={styles.chatSurface}>
          {snap.loading ? (
            <div className={styles.emptyPanel}>
              <Spin />
            </div>
          ) : (
            <ChatPanel />
          )}
        </section>
      </main>
      <CharacterModal />
      <ModelConfigDrawer />
      <MemoryDrawer />
    </div>
  )
}
