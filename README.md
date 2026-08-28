# dsh-pdf-maker

> DeepSeek Harness × PDF：用自然语言编辑 PDF，隔离草稿、实时预览、会话内审阅。

`dsh-pdf-maker` 是 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)
（DSH）的 PDF 编辑插件，交互范式对齐
[`dsh-univer-office`](https://github.com/dream-num/dsh-univer-office)：

- Agent 创建**隔离草稿 worktree**，绝不直接改原文件；
- 用 `pdf_edit` 做结构化编辑（表单填写、文字标注）；
- 用户明确确认后 **merge**（合入）或 **discard**（放弃）。

## 安装

```sh
dsh plugin --profile web add dsh-pdf-maker
dsh web   # 重启 DSH，然后 Cmd+R 刷新浏览器
```

## 快速上手

```text
给 contracts/sample.pdf 的「签署人」表单字段填上你的名字，创建一个草稿让我审阅。
```

Agent 会依次调用 `pdf_status` → `pdf_worktree create` → `pdf_edit` → `pdf_status`，
然后等你确认 merge 或 discard。

## 内置工具

| 工具 | 作用 |
|---|---|
| `pdf_new` | 创建新的空白 PDF |
| `pdf_status` | 查看文件与草稿 worktree 状态 |
| `pdf_worktree` | 创建 / ready / reopen / merge / discard 隔离草稿 |
| `pdf_edit` | 对草稿应用结构化编辑（form / text） |
| `pdf_export` | 导出 trunk 或草稿副本 |
| `pdf_screenshot` | 渲染页面为 PNG（渲染引擎接线中） |

## 当前阶段

- 已完成：worktree 生命周期、核心编辑工具、浏览器 API、会话审阅卡片、Skill、构建。
- 进行中：Gateway 内嵌 pdf.js Viewer 与渲染（`pdf_screenshot`）、OCR、Office 格式扩展。

引擎选型与工程约束见 [`AGENTS.md`](AGENTS.md) 与 [`docs/architecture.md`](docs/architecture.md)。

## 开发

```sh
pnpm install
pnpm run lint
pnpm run typecheck
pnpm run build
pnpm run test:host
```

## 许可

[MIT](LICENSE)
