export type ChatRole = 'system' | 'user' | 'assistant'

export type ChatMessageStatus =
  | 'pending'
  | 'streaming'
  | 'completed'
  | 'failed'
  | 'cancelled'

export type ModelProvider = 'siliconflow'

export type SecretKind = 'apiKey'

export interface TimestampedEntity {
  createdAt: string
  updatedAt: string
}

export interface CharacterCard extends TimestampedEntity {
  id: string
  name: string
  background: string
  description: string
  openingMessage: string
}

export interface ChatThread extends TimestampedEntity {
  id: string
  characterId: string
  title: string
}

export interface ChatMessage extends TimestampedEntity {
  id: string
  threadId: string
  role: ChatRole
  content: string
  status: ChatMessageStatus
}

export interface MemorySummary {
  threadId: string
  summary: string
  summarizedUntilMessageId?: string
  updatedAt: string
}

export interface ModelConfig extends TimestampedEntity {
  id: string
  provider: ModelProvider
  name: string
  baseUrl: string
  model: string
  temperature: number
  topP: number
  maxTokens: number
  enableThinking: boolean
  apiKeySecretId?: string
}

export interface SecretRecord extends TimestampedEntity {
  id: string
  kind: SecretKind
  name: string
  value: string
}

export type CreateCharacterCardInput = Partial<Pick<CharacterCard, 'id'>> &
  Omit<CharacterCard, 'id' | 'createdAt' | 'updatedAt'>

export type UpdateCharacterCardInput = Partial<
  Omit<CharacterCard, 'id' | 'createdAt' | 'updatedAt'>
>

export type CreateChatThreadInput = Partial<Pick<ChatThread, 'id'>> &
  Omit<ChatThread, 'id' | 'createdAt' | 'updatedAt'>

export type UpdateChatThreadInput = Partial<
  Omit<ChatThread, 'id' | 'createdAt' | 'updatedAt'>
>

export type SaveChatMessageInput = Partial<
  Pick<ChatMessage, 'id' | 'status'>
> &
  Omit<ChatMessage, 'id' | 'status' | 'createdAt' | 'updatedAt'>

export type UpdateChatMessageInput = Partial<
  Omit<ChatMessage, 'id' | 'createdAt' | 'updatedAt'>
>

export type SaveMemorySummaryInput = Omit<MemorySummary, 'updatedAt'>

export type SaveModelConfigInput = Partial<Pick<ModelConfig, 'id'>> &
  Omit<ModelConfig, 'id' | 'createdAt' | 'updatedAt'>

export type UpdateModelConfigInput = Partial<
  Omit<ModelConfig, 'id' | 'createdAt' | 'updatedAt'>
>

export type SaveSecretRecordInput = Partial<Pick<SecretRecord, 'id'>> &
  Omit<SecretRecord, 'id' | 'createdAt' | 'updatedAt'>

export type UpdateSecretRecordInput = Partial<
  Omit<SecretRecord, 'id' | 'createdAt' | 'updatedAt'>
>

export interface StorageAdapter {
  init(): Promise<void>

  listCharacters(): Promise<CharacterCard[]>
  getCharacter(id: string): Promise<CharacterCard | undefined>
  createCharacter(input: CreateCharacterCardInput): Promise<CharacterCard>
  updateCharacter(
    id: string,
    input: UpdateCharacterCardInput,
  ): Promise<CharacterCard>
  deleteCharacter(id: string): Promise<void>

  listThreads(characterId?: string): Promise<ChatThread[]>
  getThread(id: string): Promise<ChatThread | undefined>
  createThread(input: CreateChatThreadInput): Promise<ChatThread>
  updateThread(id: string, input: UpdateChatThreadInput): Promise<ChatThread>
  deleteThread(id: string): Promise<void>

  listMessagesByThread(threadId: string): Promise<ChatMessage[]>
  saveMessages(input: SaveChatMessageInput[]): Promise<ChatMessage[]>
  updateMessage(
    id: string,
    input: UpdateChatMessageInput,
  ): Promise<ChatMessage>
  deleteMessagesByThread(threadId: string): Promise<void>

  getMemorySummary(threadId: string): Promise<MemorySummary | undefined>
  saveMemorySummary(input: SaveMemorySummaryInput): Promise<MemorySummary>
  deleteMemorySummary(threadId: string): Promise<void>

  listModelConfigs(): Promise<ModelConfig[]>
  getModelConfig(id: string): Promise<ModelConfig | undefined>
  saveModelConfig(input: SaveModelConfigInput): Promise<ModelConfig>
  updateModelConfig(
    id: string,
    input: UpdateModelConfigInput,
  ): Promise<ModelConfig>
  deleteModelConfig(id: string): Promise<void>

  getSecret(id: string): Promise<SecretRecord | undefined>
  saveSecret(input: SaveSecretRecordInput): Promise<SecretRecord>
  updateSecret(id: string, input: UpdateSecretRecordInput): Promise<SecretRecord>
  deleteSecret(id: string): Promise<void>
}
