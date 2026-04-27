import type { CharacterCard, ChatMessage, MemorySummary } from '../../types/storage'
import type { LlmMessage } from '../../types/llm'

export interface MemoryConfig {
  recentRounds: number
  summaryTriggerRounds: number
}

export const defaultMemoryConfig: MemoryConfig = {
  recentRounds: 12,
  summaryTriggerRounds: 24,
}

const toRoundMessageLimit = (rounds: number) => rounds * 2

export const createRoleplaySystemPrompt = (character: CharacterCard) =>
  [
    '你正在参与一场中文角色扮演聊天。',
    `角色名：${character.name}`,
    `背景设定：${character.background}`,
    `角色描述：${character.description}`,
    '请始终保持角色口吻和设定，延续已有剧情，不要主动跳出角色说明自己是 AI。',
  ].join('\n\n')

export const buildMemoryPrompt = (summary?: MemorySummary) =>
  summary?.summary
    ? `以下是此前剧情和关系的长期记忆摘要，请在后续回复中保持连续性：\n${summary.summary}`
    : ''

export const buildChatContextMessages = (
  character: CharacterCard,
  messages: ChatMessage[],
  summary?: MemorySummary,
  config: MemoryConfig = defaultMemoryConfig,
): LlmMessage[] => {
  const recentMessages = messages.slice(-toRoundMessageLimit(config.recentRounds))
  const memoryPrompt = buildMemoryPrompt(summary)
  const systemContent = memoryPrompt
    ? `${createRoleplaySystemPrompt(character)}\n\n${memoryPrompt}`
    : createRoleplaySystemPrompt(character)

  return [
    {
      role: 'system',
      content: systemContent,
    },
    ...recentMessages
      .filter((message) => message.role !== 'system')
      .map((message) => ({
        role: message.role,
        content: message.content,
      })),
  ]
}

export const getMessagesForSummary = (
  messages: ChatMessage[],
  summary?: MemorySummary,
  config: MemoryConfig = defaultMemoryConfig,
) => {
  const recentLimit = toRoundMessageLimit(config.recentRounds)
  const summarizeCandidates = messages.slice(0, Math.max(0, messages.length - recentLimit))

  if (!summary?.summarizedUntilMessageId) {
    return summarizeCandidates
  }

  const summarizedIndex = summarizeCandidates.findIndex(
    (message) => message.id === summary.summarizedUntilMessageId,
  )

  if (summarizedIndex < 0) {
    return summarizeCandidates
  }

  return summarizeCandidates.slice(summarizedIndex + 1)
}

export const shouldSummarizeMessages = (
  messages: ChatMessage[],
  summary?: MemorySummary,
  config: MemoryConfig = defaultMemoryConfig,
) => getMessagesForSummary(messages, summary, config).length >= toRoundMessageLimit(config.summaryTriggerRounds)
