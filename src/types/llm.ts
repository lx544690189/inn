import type { CharacterCard, ChatMessage, ModelConfig } from './storage'

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LlmDelta {
  content: string
}

export interface LlmRuntimeConfig {
  modelConfig: ModelConfig
  apiKey: string
}

export interface StreamChatInput extends LlmRuntimeConfig {
  messages: LlmMessage[]
  signal?: AbortSignal
}

export interface SummarizeConversationInput extends LlmRuntimeConfig {
  character: CharacterCard
  previousSummary?: string
  messages: ChatMessage[]
  signal?: AbortSignal
}

export interface LlmService {
  streamChat(input: StreamChatInput): AsyncGenerator<LlmDelta>
  summarizeConversation(input: SummarizeConversationInput): Promise<string>
}
