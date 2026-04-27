import type {
  LlmDelta,
  LlmMessage,
  StreamChatInput,
  SummarizeConversationInput,
} from '../types/llm'

interface SiliconFlowChatChoice {
  delta?: {
    content?: string
  }
  message?: {
    content?: string
  }
}

interface SiliconFlowChatResponse {
  choices?: SiliconFlowChatChoice[]
}

const buildChatUrl = (baseUrl: string) =>
  `${baseUrl.replace(/\/$/, '')}/chat/completions`

const createHeaders = (apiKey: string) => ({
  Authorization: `Bearer ${apiKey}`,
  'Content-Type': 'application/json',
})

const createBody = (
  input: Pick<StreamChatInput, 'modelConfig'> & {
    messages: LlmMessage[]
    stream: boolean
  },
) => ({
  model: input.modelConfig.model,
  messages: input.messages,
  stream: input.stream,
  temperature: input.modelConfig.temperature,
  top_p: input.modelConfig.topP,
  max_tokens: input.modelConfig.maxTokens,
  enable_thinking: input.modelConfig.enableThinking,
})

const assertResponseOk = async (response: Response) => {
  if (response.ok) {
    return
  }

  const errorText = await response.text()
  throw new Error(errorText || `硅基流动请求失败：${response.status}`)
}

const parseStreamLine = (line: string) => {
  if (!line.startsWith('data:')) {
    return undefined
  }

  const data = line.replace(/^data:\s*/, '')

  if (!data || data === '[DONE]') {
    return undefined
  }

  const parsed = JSON.parse(data) as SiliconFlowChatResponse

  return parsed.choices?.[0]?.delta?.content
}

export async function* streamSiliconFlowChat(
  input: StreamChatInput,
): AsyncGenerator<LlmDelta> {
  const response = await fetch(buildChatUrl(input.modelConfig.baseUrl), {
    method: 'POST',
    headers: createHeaders(input.apiKey),
    body: JSON.stringify(createBody({ ...input, stream: true })),
    signal: input.signal,
  })

  await assertResponseOk(response)

  if (!response.body) {
    throw new Error('当前浏览器不支持流式响应读取')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()

    if (done) {
      break
    }

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const content = parseStreamLine(line.trim())

      if (content) {
        yield { content }
      }
    }
  }
}

export const requestSiliconFlowChat = async (
  input: StreamChatInput,
): Promise<string> => {
  const response = await fetch(buildChatUrl(input.modelConfig.baseUrl), {
    method: 'POST',
    headers: createHeaders(input.apiKey),
    body: JSON.stringify(createBody({ ...input, stream: false })),
    signal: input.signal,
  })

  await assertResponseOk(response)

  const data = (await response.json()) as SiliconFlowChatResponse

  return data.choices?.[0]?.message?.content ?? ''
}

export const buildSummaryMessages = (input: SummarizeConversationInput) => {
  const conversation = input.messages
    .map((message) => `${message.role}: ${message.content}`)
    .join('\n')

  return [
    {
      role: 'system',
      content:
        '你负责为角色扮演聊天生成长期记忆摘要。请只保留会影响后续剧情连续性的事实、关系、承诺、目标、禁忌和用户偏好，不要写寒暄。',
    },
    {
      role: 'user',
      content: [
        `角色名：${input.character.name}`,
        `角色背景：${input.character.background}`,
        `角色描述：${input.character.description}`,
        `已有摘要：${input.previousSummary || '暂无'}`,
        '新增对话：',
        conversation,
        '请输出一段简洁、可继续累积更新的中文摘要。',
      ].join('\n\n'),
    },
  ] satisfies LlmMessage[]
}
