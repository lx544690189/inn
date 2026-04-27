import dayjs from 'dayjs'
import { proxy, ref } from 'valtio'
import { SiliconFlowService } from '../services/llm'
import {
  buildChatContextMessages,
  defaultMemoryConfig,
  getMessagesForSummary,
  shouldSummarizeMessages,
  type MemoryConfig,
} from '../services/memory'
import { createStorageAdapter } from '../services/storage'
import type {
  CharacterCard,
  ChatMessage,
  ChatMessageStatus,
  ChatThread,
  ModelConfig,
  SecretRecord,
  StorageAdapter,
} from '../types/storage'

const DEFAULT_MODEL_CONFIG: Omit<
  ModelConfig,
  'id' | 'createdAt' | 'updatedAt' | 'apiKeySecretId'
> = {
  provider: 'siliconflow',
  name: '硅基流动',
  baseUrl: 'https://api.siliconflow.cn/v1',
  model: 'Qwen/Qwen3-32B',
  temperature: 0.8,
  topP: 0.7,
  maxTokens: 2048,
  enableThinking: false,
}

const readText = (value: string) => value.trim()

class RoleplayStore {
  private readonly storage: StorageAdapter
  private readonly llm = ref(new SiliconFlowService())
  private abortController?: AbortController

  initialized = false
  loading = false
  running = false
  error = ''

  characters: CharacterCard[] = []
  threads: ChatThread[] = []
  messages: ChatMessage[] = []
  modelConfigs: ModelConfig[] = []
  activeCharacterId = ''
  activeThreadId = ''
  activeModelConfigId = ''
  activeApiKey = ''

  memorySummary = ''
  summarizedUntilMessageId = ''
  memoryConfig: MemoryConfig = { ...defaultMemoryConfig }

  characterModal = {
    open: false,
    characterId: '',
  }

  modelDrawerOpen = false
  memoryDrawerOpen = false

  constructor(storage = createStorageAdapter()) {
    this.storage = ref(storage)
  }

  async init() {
    if (this.initialized || this.loading) {
      return
    }

    this.loading = true
    this.error = ''

    try {
      await this.storage.init()
      await this.loadModelConfigs()
      await this.loadCharacters()
      this.initialized = true
    } catch (error) {
      this.error = this.getErrorMessage(error)
    } finally {
      this.loading = false
    }
  }

  openCreateCharacterModal() {
    this.characterModal = {
      open: true,
      characterId: '',
    }
  }

  openEditCharacterModal(characterId: string) {
    this.characterModal = {
      open: true,
      characterId,
    }
  }

  closeCharacterModal() {
    this.characterModal = {
      open: false,
      characterId: '',
    }
  }

  setModelDrawerOpen(open: boolean) {
    this.modelDrawerOpen = open
  }

  setMemoryDrawerOpen(open: boolean) {
    this.memoryDrawerOpen = open
  }

  async saveCharacter(
    input: Pick<
      CharacterCard,
      'name' | 'background' | 'description' | 'openingMessage'
    >,
  ) {
    const characterId = this.characterModal.characterId

    if (characterId) {
      await this.storage.updateCharacter(characterId, input)
    } else {
      const character = await this.storage.createCharacter(input)
      this.activeCharacterId = character.id
    }

    await this.loadCharacters()

    if (this.activeCharacterId) {
      await this.selectCharacter(this.activeCharacterId)
    }

    this.closeCharacterModal()
  }

  async deleteCharacter(characterId: string) {
    await this.storage.deleteCharacter(characterId)

    if (this.activeCharacterId === characterId) {
      this.activeCharacterId = ''
      this.activeThreadId = ''
      this.threads = []
      this.messages = []
      this.memorySummary = ''
      this.summarizedUntilMessageId = ''
    }

    await this.loadCharacters()
  }

  async selectCharacter(characterId: string) {
    this.activeCharacterId = characterId
    this.threads = await this.storage.listThreads(characterId)

    if (this.threads.length > 0) {
      await this.selectThread(this.threads[0].id)
      return
    }

    this.activeThreadId = ''
    this.messages = []
    this.memorySummary = ''
    this.summarizedUntilMessageId = ''
  }

  async createThread(characterId = this.activeCharacterId) {
    const character = this.characters.find((item) => item.id === characterId)

    if (!character) {
      return
    }

    const thread = await this.storage.createThread({
      characterId,
      title: `${character.name} · ${dayjs().format('MM-DD HH:mm')}`,
    })

    if (readText(character.openingMessage)) {
      await this.storage.saveMessages([
        {
          threadId: thread.id,
          role: 'assistant',
          content: character.openingMessage,
          status: 'completed',
        },
      ])
    }

    this.threads = await this.storage.listThreads(characterId)
    await this.selectThread(thread.id)
  }

  async deleteThread(threadId: string) {
    await this.storage.deleteThread(threadId)
    this.threads = await this.storage.listThreads(this.activeCharacterId)

    if (this.activeThreadId === threadId) {
      if (this.threads.length > 0) {
        await this.selectThread(this.threads[0].id)
      } else {
        this.activeThreadId = ''
        this.messages = []
        this.memorySummary = ''
        this.summarizedUntilMessageId = ''
      }
    }
  }

  async selectThread(threadId: string) {
    this.activeThreadId = threadId
    this.messages = await this.storage.listMessagesByThread(threadId)

    const summary = await this.storage.getMemorySummary(threadId)
    this.memorySummary = summary?.summary ?? ''
    this.summarizedUntilMessageId = summary?.summarizedUntilMessageId ?? ''
  }

  async saveModelConfig(
    input: Omit<ModelConfig, 'createdAt' | 'updatedAt' | 'apiKeySecretId'> & {
      apiKey: string
    },
  ) {
    let secret: SecretRecord | undefined
    const currentConfig = this.modelConfigs.find((item) => item.id === input.id)

    if (readText(input.apiKey)) {
      if (currentConfig?.apiKeySecretId) {
        secret = await this.storage.updateSecret(currentConfig.apiKeySecretId, {
          value: input.apiKey,
          name: `${input.name} API Key`,
        })
      } else {
        secret = await this.storage.saveSecret({
          kind: 'apiKey',
          name: `${input.name} API Key`,
          value: input.apiKey,
        })
      }
    }

    const payload = {
      provider: input.provider,
      name: input.name,
      baseUrl: input.baseUrl,
      model: input.model,
      temperature: input.temperature,
      topP: input.topP,
      maxTokens: input.maxTokens,
      enableThinking: input.enableThinking,
      apiKeySecretId: secret?.id ?? currentConfig?.apiKeySecretId,
    }

    if (currentConfig) {
      await this.storage.updateModelConfig(input.id, payload)
    } else {
      const config = await this.storage.saveModelConfig(payload)
      this.activeModelConfigId = config.id
    }

    await this.loadModelConfigs()
    this.modelDrawerOpen = false
  }

  cancelRun() {
    this.abortController?.abort()
  }

  async sendUserMessage(content: string) {
    const text = readText(content)

    if (!text || this.running) {
      return
    }

    const character = this.characters.find(
      (item) => item.id === this.activeCharacterId,
    )
    const modelConfig = this.modelConfigs.find(
      (item) => item.id === this.activeModelConfigId,
    )

    if (!character) {
      this.error = '请先选择或创建角色'
      return
    }

    if (!this.activeThreadId) {
      await this.createThread(character.id)
    }

    if (!modelConfig) {
      this.error = '请先配置模型'
      this.modelDrawerOpen = true
      return
    }

    const apiKey = await this.getApiKey(modelConfig)

    if (!apiKey) {
      this.error = '请先填写硅基流动 API Key'
      this.modelDrawerOpen = true
      return
    }

    const threadId = this.activeThreadId
    const [userMessage] = await this.storage.saveMessages([
      {
        threadId,
        role: 'user',
        content: text,
        status: 'completed',
      },
    ])
    const [assistantMessage] = await this.storage.saveMessages([
      {
        threadId,
        role: 'assistant',
        content: '',
        status: 'streaming',
      },
    ])

    this.messages = [...this.messages, userMessage, assistantMessage]
    this.error = ''
    this.running = true
    this.abortController = new AbortController()

    try {
      let assistantContent = ''
      const summary = this.memorySummary
        ? {
            threadId,
            summary: this.memorySummary,
            summarizedUntilMessageId: this.summarizedUntilMessageId || undefined,
            updatedAt: new Date().toISOString(),
          }
        : undefined
      const contextMessages = buildChatContextMessages(
        character,
        [...this.messages.slice(0, -1)],
        summary,
        this.memoryConfig,
      )

      for await (const delta of this.llm.streamChat({
        modelConfig,
        apiKey,
        messages: contextMessages,
        signal: this.abortController.signal,
      })) {
        assistantContent += delta.content
        this.patchLocalMessage(assistantMessage.id, {
          content: assistantContent,
          status: 'streaming',
        })
      }

      await this.storage.updateMessage(assistantMessage.id, {
        content: assistantContent || '（模型没有返回内容）',
        status: 'completed',
      })
      this.patchLocalMessage(assistantMessage.id, {
        content: assistantContent || '（模型没有返回内容）',
        status: 'completed',
      })
      await this.touchThreadAfterMessage(threadId, text)
      await this.maybeSummarize(character, modelConfig, apiKey)
    } catch (error) {
      const cancelled = this.abortController.signal.aborted
      const status: ChatMessageStatus = cancelled ? 'cancelled' : 'failed'
      const errorText = cancelled
        ? '已取消生成'
        : this.getErrorMessage(error) || '生成失败'

      await this.storage.updateMessage(assistantMessage.id, {
        content: errorText,
        status,
      })
      this.patchLocalMessage(assistantMessage.id, {
        content: errorText,
        status,
      })
      this.error = cancelled ? '' : errorText
    } finally {
      this.running = false
      this.abortController = undefined
    }
  }

  private async loadCharacters() {
    this.characters = await this.storage.listCharacters()

    if (!this.activeCharacterId && this.characters.length > 0) {
      await this.selectCharacter(this.characters[0].id)
    }
  }

  private async loadModelConfigs() {
    this.modelConfigs = await this.storage.listModelConfigs()

    if (this.modelConfigs.length === 0) {
      const config = await this.storage.saveModelConfig(DEFAULT_MODEL_CONFIG)
      this.modelConfigs = [config]
      this.activeModelConfigId = config.id
      return
    }

    this.activeModelConfigId ||= this.modelConfigs[0].id
    const config = this.modelConfigs.find(
      (item) => item.id === this.activeModelConfigId,
    )
    this.activeApiKey = config ? await this.getApiKey(config) : ''
  }

  private async getApiKey(modelConfig: ModelConfig) {
    if (!modelConfig.apiKeySecretId) {
      return ''
    }

    const secret = await this.storage.getSecret(modelConfig.apiKeySecretId)

    return secret?.value ?? ''
  }

  private patchLocalMessage(
    messageId: string,
    input: Partial<Pick<ChatMessage, 'content' | 'status'>>,
  ) {
    this.messages = this.messages.map((message) =>
      message.id === messageId
        ? {
            ...message,
            ...input,
            updatedAt: new Date().toISOString(),
          }
        : message,
    )
  }

  private async touchThreadAfterMessage(threadId: string, userText: string) {
    const thread = this.threads.find((item) => item.id === threadId)

    if (!thread) {
      return
    }

    const userMessages = this.messages.filter((message) => message.role === 'user')
    const nextTitle =
      userMessages.length === 1 ? userText.slice(0, 18) || thread.title : thread.title

    await this.storage.updateThread(threadId, {
      title: nextTitle,
    })
    this.threads = await this.storage.listThreads(this.activeCharacterId)
  }

  private async maybeSummarize(
    character: CharacterCard,
    modelConfig: ModelConfig,
    apiKey: string,
  ) {
    const summary = this.memorySummary
      ? {
          threadId: this.activeThreadId,
          summary: this.memorySummary,
          summarizedUntilMessageId: this.summarizedUntilMessageId || undefined,
          updatedAt: new Date().toISOString(),
        }
      : undefined

    if (!shouldSummarizeMessages(this.messages, summary, this.memoryConfig)) {
      return
    }

    const messagesForSummary = getMessagesForSummary(
      this.messages,
      summary,
      this.memoryConfig,
    )

    if (messagesForSummary.length === 0) {
      return
    }

    const nextSummary = await this.llm.summarizeConversation({
      modelConfig,
      apiKey,
      character,
      previousSummary: this.memorySummary,
      messages: messagesForSummary,
    })
    const lastMessage = messagesForSummary[messagesForSummary.length - 1]
    const savedSummary = await this.storage.saveMemorySummary({
      threadId: this.activeThreadId,
      summary: nextSummary,
      summarizedUntilMessageId: lastMessage.id,
    })

    this.memorySummary = savedSummary.summary
    this.summarizedUntilMessageId =
      savedSummary.summarizedUntilMessageId ?? ''
  }

  private getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error)
  }
}

export const roleplayStore = proxy(new RoleplayStore())
