import Dexie, { type Table } from 'dexie'
import type {
  CharacterCard,
  ChatMessage,
  ChatThread,
  CreateCharacterCardInput,
  CreateChatThreadInput,
  MemorySummary,
  ModelConfig,
  SaveChatMessageInput,
  SaveMemorySummaryInput,
  SaveModelConfigInput,
  SaveSecretRecordInput,
  SecretRecord,
  StorageAdapter,
  UpdateCharacterCardInput,
  UpdateChatMessageInput,
  UpdateChatThreadInput,
  UpdateModelConfigInput,
  UpdateSecretRecordInput,
} from '../../types/storage'

const DATABASE_NAME = 'inn-roleplay'

class InnRoleplayDatabase extends Dexie {
  characters!: Table<CharacterCard, string>
  threads!: Table<ChatThread, string>
  messages!: Table<ChatMessage, string>
  memorySummaries!: Table<MemorySummary, string>
  modelConfigs!: Table<ModelConfig, string>
  secrets!: Table<SecretRecord, string>

  constructor() {
    super(DATABASE_NAME)

    this.version(1).stores({
      characters: 'id, createdAt, updatedAt',
      threads: 'id, characterId, createdAt, updatedAt',
      messages: 'id, threadId, createdAt, updatedAt',
      memorySummaries: 'threadId, updatedAt',
      modelConfigs: 'id, provider, createdAt, updatedAt',
      secrets: 'id, kind, createdAt, updatedAt',
    })
  }
}

const createId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

const now = () => new Date().toISOString()

const sortByUpdatedAtDesc = <T extends { updatedAt: string }>(items: T[]) =>
  items.sort((current, next) => next.updatedAt.localeCompare(current.updatedAt))

const sortByCreatedAtAsc = <T extends { createdAt: string }>(items: T[]) =>
  items.sort((current, next) => current.createdAt.localeCompare(next.createdAt))

const assertFound = <T>(value: T | undefined, name: string, id: string): T => {
  if (!value) {
    throw new Error(`${name} not found: ${id}`)
  }

  return value
}

export class DexieIndexedDbAdapter implements StorageAdapter {
  private readonly db: InnRoleplayDatabase

  constructor(database = new InnRoleplayDatabase()) {
    this.db = database
  }

  async init() {
    await this.db.open()
  }

  async listCharacters() {
    return sortByUpdatedAtDesc(await this.db.characters.toArray())
  }

  async getCharacter(id: string) {
    return this.db.characters.get(id)
  }

  async createCharacter(input: CreateCharacterCardInput) {
    const timestamp = now()
    const character: CharacterCard = {
      ...input,
      id: input.id ?? createId(),
      createdAt: timestamp,
      updatedAt: timestamp,
    }

    await this.db.characters.put(character)

    return character
  }

  async updateCharacter(id: string, input: UpdateCharacterCardInput) {
    const character = assertFound(
      await this.db.characters.get(id),
      'Character',
      id,
    )
    const nextCharacter: CharacterCard = {
      ...character,
      ...input,
      id,
      updatedAt: now(),
    }

    await this.db.characters.put(nextCharacter)

    return nextCharacter
  }

  async deleteCharacter(id: string) {
    await this.db.transaction(
      'rw',
      this.db.characters,
      this.db.threads,
      this.db.messages,
      this.db.memorySummaries,
      async () => {
        const threads = await this.db.threads
          .where('characterId')
          .equals(id)
          .toArray()
        const threadIds = threads.map((thread) => thread.id)

        if (threadIds.length > 0) {
          await this.db.messages.where('threadId').anyOf(threadIds).delete()
          await this.db.memorySummaries
            .where('threadId')
            .anyOf(threadIds)
            .delete()
          await this.db.threads.where('id').anyOf(threadIds).delete()
        }

        await this.db.characters.delete(id)
      },
    )
  }

  async listThreads(characterId?: string) {
    const threads = characterId
      ? await this.db.threads.where('characterId').equals(characterId).toArray()
      : await this.db.threads.toArray()

    return sortByUpdatedAtDesc(threads)
  }

  async getThread(id: string) {
    return this.db.threads.get(id)
  }

  async createThread(input: CreateChatThreadInput) {
    const timestamp = now()
    const thread: ChatThread = {
      ...input,
      id: input.id ?? createId(),
      createdAt: timestamp,
      updatedAt: timestamp,
    }

    await this.db.threads.put(thread)

    return thread
  }

  async updateThread(id: string, input: UpdateChatThreadInput) {
    const thread = assertFound(await this.db.threads.get(id), 'Thread', id)
    const nextThread: ChatThread = {
      ...thread,
      ...input,
      id,
      updatedAt: now(),
    }

    await this.db.threads.put(nextThread)

    return nextThread
  }

  async deleteThread(id: string) {
    await this.db.transaction(
      'rw',
      this.db.threads,
      this.db.messages,
      this.db.memorySummaries,
      async () => {
        await this.db.messages.where('threadId').equals(id).delete()
        await this.db.memorySummaries.delete(id)
        await this.db.threads.delete(id)
      },
    )
  }

  async listMessagesByThread(threadId: string) {
    const messages = await this.db.messages
      .where('threadId')
      .equals(threadId)
      .toArray()

    return sortByCreatedAtAsc(messages)
  }

  async saveMessages(input: SaveChatMessageInput[]) {
    const messages = input.map((message) => {
      const timestamp = now()

      return {
        ...message,
        id: message.id ?? createId(),
        status: message.status ?? 'completed',
        createdAt: timestamp,
        updatedAt: timestamp,
      } satisfies ChatMessage
    })

    await this.db.messages.bulkPut(messages)

    return messages
  }

  async updateMessage(id: string, input: UpdateChatMessageInput) {
    const message = assertFound(await this.db.messages.get(id), 'Message', id)
    const nextMessage: ChatMessage = {
      ...message,
      ...input,
      id,
      updatedAt: now(),
    }

    await this.db.messages.put(nextMessage)

    return nextMessage
  }

  async deleteMessagesByThread(threadId: string) {
    await this.db.messages.where('threadId').equals(threadId).delete()
  }

  async getMemorySummary(threadId: string) {
    return this.db.memorySummaries.get(threadId)
  }

  async saveMemorySummary(input: SaveMemorySummaryInput) {
    const summary: MemorySummary = {
      ...input,
      updatedAt: now(),
    }

    await this.db.memorySummaries.put(summary)

    return summary
  }

  async deleteMemorySummary(threadId: string) {
    await this.db.memorySummaries.delete(threadId)
  }

  async listModelConfigs() {
    return sortByUpdatedAtDesc(await this.db.modelConfigs.toArray())
  }

  async getModelConfig(id: string) {
    return this.db.modelConfigs.get(id)
  }

  async saveModelConfig(input: SaveModelConfigInput) {
    const timestamp = now()
    const config: ModelConfig = {
      ...input,
      id: input.id ?? createId(),
      createdAt: timestamp,
      updatedAt: timestamp,
    }

    await this.db.modelConfigs.put(config)

    return config
  }

  async updateModelConfig(id: string, input: UpdateModelConfigInput) {
    const config = assertFound(
      await this.db.modelConfigs.get(id),
      'Model config',
      id,
    )
    const nextConfig: ModelConfig = {
      ...config,
      ...input,
      id,
      updatedAt: now(),
    }

    await this.db.modelConfigs.put(nextConfig)

    return nextConfig
  }

  async deleteModelConfig(id: string) {
    await this.db.modelConfigs.delete(id)
  }

  async getSecret(id: string) {
    return this.db.secrets.get(id)
  }

  async saveSecret(input: SaveSecretRecordInput) {
    const timestamp = now()
    const secret: SecretRecord = {
      ...input,
      id: input.id ?? createId(),
      createdAt: timestamp,
      updatedAt: timestamp,
    }

    await this.db.secrets.put(secret)

    return secret
  }

  async updateSecret(id: string, input: UpdateSecretRecordInput) {
    const secret = assertFound(await this.db.secrets.get(id), 'Secret', id)
    const nextSecret: SecretRecord = {
      ...secret,
      ...input,
      id,
      updatedAt: now(),
    }

    await this.db.secrets.put(nextSecret)

    return nextSecret
  }

  async deleteSecret(id: string) {
    await this.db.secrets.delete(id)
  }
}
