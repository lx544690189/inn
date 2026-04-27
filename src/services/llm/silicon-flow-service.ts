import {
  buildSummaryMessages,
  requestSiliconFlowChat,
  streamSiliconFlowChat,
} from '../../api/silicon-flow'
import type {
  LlmDelta,
  LlmService,
  StreamChatInput,
  SummarizeConversationInput,
} from '../../types/llm'

export class SiliconFlowService implements LlmService {
  streamChat(input: StreamChatInput): AsyncGenerator<LlmDelta> {
    return streamSiliconFlowChat(input)
  }

  summarizeConversation(input: SummarizeConversationInput) {
    return requestSiliconFlowChat({
      ...input,
      messages: buildSummaryMessages(input),
    })
  }
}
