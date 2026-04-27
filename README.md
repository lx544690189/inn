# Vite + React + TypeScript + Ant Design

## GitHub Actions 自动打包部署

仓库已经包含工作流：`.github/workflows/deploy.yml`。

### 触发方式

- 推送到 `main` 分支自动触发。
- 在 GitHub Actions 页面手动触发（`workflow_dispatch`）。

### 部署目标

- 自动构建后发布到 **GitHub Pages**。
- 构建命令会自动注入 base 路径：`/${仓库名}/`，适配 Pages 子路径访问。

### 首次使用需要检查

1. 进入仓库 `Settings` -> `Pages`。
2. `Build and deployment` 选择 **GitHub Actions**。
3. 确保默认分支为 `main`（或把工作流里的分支改成你的实际分支）。
