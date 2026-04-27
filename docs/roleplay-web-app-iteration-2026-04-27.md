# 角色扮演 Web 应用迭代记录

日期：2026-04-27

## 本次目标

将初始 Vite + React + Ant Design 骨架推进到可用的 PC 端角色扮演聊天应用雏形，完成本地持久化、角色卡、会话、模型配置、聊天运行时和基础记忆能力。

本次不做后端服务、不做 Electron SQLite、不做 localStorage 适配器、不接 RAG/embedding、不启动本地 dev 服务。

## 已实现内容

- 接入 `assistant-ui` 作为聊天运行时和消息输入/渲染基础。
- 使用 Valtio class store 管理业务状态，React 组件主要负责展示和触发 store 方法。
- 使用 Dexie 封装 IndexedDB，默认数据库名为 `inn-roleplay`。
- 支持角色卡模块：
  - 角色名
  - 背景设定
  - 角色描述
  - 开场白
- 支持会话模块：
  - 按角色创建会话
  - 新会话自动写入角色开场白
  - 删除角色时级联删除其会话、消息和记忆摘要
  - 删除会话时级联删除其消息和记忆摘要
- 支持模型配置：
  - v1 供应商为硅基流动
  - API Key 由用户在前端填写
  - API Key 保存到本地 IndexedDB 的 `secrets` 表
  - 默认 `baseUrl` 为 `https://api.siliconflow.cn/v1`
- 支持硅基流动 Chat Completions：
  - 流式聊天回复
  - 非流式摘要生成
  - 支持取消当前生成
- 支持基础记忆：
  - 默认保留最近 12 轮对话进入上下文
  - 默认超过 24 轮触发自动摘要
  - 摘要保存到 IndexedDB
  - 请求模型时注入角色设定、长期摘要和最近上下文
- 完成 PC 双栏工作台：
  - 左侧为角色和会话管理
  - 右侧为聊天区、模型配置入口、记忆入口
- 完成暖色主题：
  - Ant Design token 主色为 `#b86b3d`
  - 页面背景和聊天气泡使用暖色系
  - 页面组件样式使用 Less CSS Modules
- 修复中文输入法组合态问题：
  - 输入相关组件读取 `roleplayStore` 时使用 `useSnapshot(roleplayStore, { sync: true })`
  - 避免 Valtio 异步快照更新干扰中文输入法组合态
  - 聊天输入框保持 `submitMode="enter"`

## 关键文件

- 应用入口：`src/App.tsx`
- 全局样式：`src/index.less`
- 页面：`src/pages/roleplay/index.tsx`
- 页面样式：`src/pages/roleplay/index.module.less`
- 状态层：`src/stores/roleplay-store.ts`
- IndexedDB 适配器：`src/services/storage/dexie-indexed-db-adapter.ts`
- 存储接口类型：`src/types/storage.ts`
- 硅基流动 API：`src/api/silicon-flow.ts`
- LLM service：`src/services/llm/silicon-flow-service.ts`
- LLM 类型：`src/types/llm.ts`
- 记忆服务：`src/services/memory/index.ts`
- Less module 声明：`src/vite-env.d.ts`

## 存储设计

`DexieIndexedDbAdapter` 实现统一的 `StorageAdapter` 接口，v1 schema 包含：

- `characters`
- `threads`
- `messages`
- `memorySummaries`
- `modelConfigs`
- `secrets`

常用索引：

- `characterId`
- `threadId`
- `createdAt`
- `updatedAt`

时间戳统一使用 ISO 字符串。写入方法由 adapter 补齐 `createdAt` 和 `updatedAt`，调用层不直接维护时间戳。

## 状态与数据流

核心状态集中在 `RoleplayStore`：

- 初始化时打开 IndexedDB，读取模型配置和角色列表。
- 如果没有模型配置，自动创建一条默认硅基流动配置。
- 选择角色后加载该角色会话。
- 选择会话后加载消息和记忆摘要。
- 发送消息时：
  - 保存用户消息
  - 创建空 assistant 消息
  - 使用角色设定、长期摘要和最近上下文请求硅基流动
  - 流式更新 assistant 消息
  - 完成后持久化最终内容
  - 必要时触发摘要生成

`storage` 和 `llm` 实例通过 Valtio `ref` 标记，避免被深度代理。

## assistant-ui 接入方式

本次使用 `useExternalStoreRuntime`，由项目自己的 Valtio store 持有消息状态。

消息桥接逻辑：

- 项目内部消息类型：`ChatMessage`
- assistant-ui 消息类型：`ThreadMessageLike`
- 转换函数：页面内 `toThreadMessage`
- 用户发送：`onNew` 读取 assistant-ui 的 `AppendMessage` 文本后调用 `roleplayStore.sendUserMessage`
- 取消生成：`onCancel` 调用 `roleplayStore.cancelRun`

v1 暂不支持附件、工具调用、语音和多分支编辑。

## 模型配置与安全说明

当前 API Key 存在浏览器本地 IndexedDB 中，仅适合本地使用或早期原型。

后续正式分发时建议：

- 改为后端代理模型请求
- 或在 Electron 中接入系统密钥链/本地加密
- 或将 `SecretRecord` 的实现替换为更安全的 secret provider

LLM service 的接口保持浏览器/Node 迁移友好，后续可将 `src/api/silicon-flow.ts` 和 `src/services/llm/` 移到 Node.js 后端。

## 验证结果

已执行：

```bash
pnpm build
```

结果：

- TypeScript 构建通过
- Vite 构建通过
- 构建后生成的 `dist/` 和 `tsconfig.*.tsbuildinfo` 已清理
- Vite 提示 chunk 超过 500kB，这是 Ant Design 和 assistant-ui 引入后的产物体积提示，不是错误

未执行：

- 未启动 `pnpm dev`
- 未做浏览器人工验收

## 修复记录

- 2026-04-27：为聊天输入、角色表单、模型配置表单、记忆配置等输入相关组件的 `useSnapshot` 增加 `{ sync: true }`，修复中文输入法组合态被 Valtio 快照更新干扰的问题。

## 后续建议

- 浏览器验收：
  - 创建角色
  - 创建会话
  - 填写硅基流动 API Key
  - 发送消息并观察流式回复
  - 刷新页面后确认角色、会话、消息、模型配置能从 IndexedDB 恢复
- 增加模型请求错误的结构化展示，例如网络错误、鉴权错误、模型不存在。
- 增加导入/导出数据能力，方便备份 IndexedDB 数据。
- 增加 localStorage 或 Electron SQLite 适配器时，只需要实现 `StorageAdapter`。
- 若后续关注首屏体积，可引入路由级懒加载或 Vite manual chunks。
