# 概述

始终用中文和我对话

# 项目规范

## 基础信息

技术栈：react、typescript、less、vite、ant design、valtio、lodash-es、dayjs、classnames
私有库：

- @yi/ui 基于antd的业务组件库
- @yi/request 基于axios的请求库

## 代码规范

### react

- **尽量不使用react的hooks**，状态相关使用valtio
- react组件只作为UI展示，逻辑集中在状态层
- 组件按功能拆分，防止文件过长

### 样式

- 必须使用 Less 编写样式
- 样式文件与组件同目录，命名为 `index.less`
- 非公共组件，必须使用css module做样式隔离

### 组件

- 页面级组件放在当前页面的 `components/` 目录下，如`components/my-component/index.tsx`
- 公共组件放在 `src/components/` 目录下，如`components/my-component/index.tsx`

### 页面结构及示例

- 页面文件放在 `src/pages/` 目录下

### 状态管理

- 使用 Valtio 进行状态管理
- 必须使用 class 创建状态实例
- 适当合并状态&方法：比如编辑弹窗有open、data等状态，使用一个json对象`modal:{open:boolean,data:any}`来表示。如果比较复杂，直接新增`EditModal class`，并初始化`editModal = new EditModal()`，并在EditModal封装相关方法，保持主store干净

### 代码格式化

- 使用 Biome + Ultracite 进行格式化和 lint
- 你每次改动的代码需要遵循当前项目的代码规范
- 保存时自动格式化

## 注意事项

- 安装第三方npm包，先询问
- 修改配置文件前先询问
- API 接口定义放在 `src/api/` 目录
- 类型定义放在 `src/types/` 目录
- 本地已启动开发服务，请勿执行dev命令
- 仅当 `Input` / `Input.TextArea` / 受控文本输入直接读取 `useSnapshot` 的值，并在 `onChange` 里立刻回写到 `store` 时，才给对应的 `useSnapshot` 增加 `sync: true`；纯展示读取不要加，避免中文输入法组合态异常

## Git 提交

- 提交 commit 前，展示以下信息：
  - 📝 **提交信息**: commit message 内容
  - 🎯 **影响范围**: 改动可能影响的功能模块或业务范围
- commit信息使用中文，简短
- 适当按功能点分次提交
