# AGENTS.md — dsh-pdf-maker

DeepSeek Harness (dsh) 的 PDF 编辑插件，使用方式对齐 `dsh-univer-office`（隔离草稿 worktree → 实时预览 → 会话审阅卡片 → merge/discard，自然语言驱动）。项目将开源在 GitHub。

## 核心定位

- 复刻 `dsh-univer-office` 的交互范式：Agent 创建隔离草稿 → 实时预览窗口 → 回合尾部审阅卡片 → 用户明确确认后 merge 或 discard。
- 一期做 PDF（注释层/表单/结构编辑 + 渲染预览），后续扩展 Office 全格式。
- 采用"单 npm 包 + 多个 Cordis 插件角色"结构，复制 univer 插件的六件套骨架：Service + Provider / Tools Consumer / webServer Consumer / Skill Provider / 内置 Gateway 子进程 / Client。

## 构建与运行

| 命令 | 说明 |
|---|---|
| `pnpm install` | 安装依赖（pnpm only） |
| `pnpm run lint` | 代码检查 |
| `pnpm run typecheck` | 类型检查 |
| `pnpm run build` | 生成 Host ESM / Client bundle / Gateway CJS / Worker ESM / Vite 静态资产 |
| `pnpm run test` | 分层 smoke 测试 |
| `dsh plugin --profile web add <包名>` | 本地安装到 DSH web profile |
| `dsh web` | 重启 DSH 后 Cmd+R 刷新加载插件 |

## PDF 引擎选型（已定，勿改）

核心原则：**全 npm、纯 JS/WASM，全宽松许可证（MIT/Apache/BSD/MPL），禁止 AGPL 传染。**

| 用途 | 引擎 | 许可证 | 形态 |
|---|---|---|---|
| 渲染 + 文本提取（预览/截图） | `pdfjs-dist` | Apache-2.0 | JS/WASM |
| 结构编辑 + 注释 + 表单（一期主力） | `pdf-lib` | MIT | 纯 JS |
| 中文字体嵌入（表单/文字写入） | `fontkit` + 系统字体发现 | MIT / OFL | JS |
| 结构级操作补刀（加密/线性化/对象级） | `qpdf-wasm` | Apache-2.0 | WASM |
| 内容级编辑（二期，范式 B） | PDFium WASM（`@embedpdf/pdfium` 或 `@hyzyla/pdfium`） | BSD-3 内核 / MIT 封装 | WASM |
| 扫描件 OCR（可选） | `tesseract.js` | Apache-2.0 | WASM |
| Office 格式扩展（远期） | LibreOffice headless | MPL-2.0 | 外部进程，不打包 |

### 明确禁用（AGPL 或运行时污染，勿引入）

- MuPDF / PyMuPDF（AGPL）
- Ghostscript（AGPL）
- ONLYOFFICE（AGPL）
- Apache PDFBox（Apache-2.0 但需 JVM，破坏单包体验）
- 任何要求用户额外安装 Python / Java / 系统二进制才能运行的引擎

### 许可证决策

- 插件本体开源用 MIT（或 Apache-2.0）。
- 引入新依赖前必须核对许可证，任何 AGPL 依赖需先评审。

## 编辑范式路线图

| 阶段 | 范式 | 说明 |
|---|---|---|
| 一期 | A. 注释层编辑 | 在原 PDF 上叠标注/高亮/文本框/表单填写，`pdf-lib` 写 annotation，`pdfjs-dist` 渲染，不碰内容流 |
| 二期 | C. 往返重建 | PDF → 可编辑中间格式 → LLM 改 → 重渲染（LibreOffice/weasyprint 侧），做"AI 改文档"的保真重排 |
| 三期 | B. 内容级编辑 | 改内容流/移动缩放对象，用 PDFium WASM；注意 PDF 文字无法重排，换字需等宽才不破版 |

## 架构约束（对齐 dsh-univer-office）

- 依赖方向：`client components → client hooks → client api → shared/wire`；`webServer/tools → service ← provider → adapters → processes/workers`。
- Provider 是唯一能组合 Gateway、Worker、文件操作的层；webServer 和 Tools 只能调 `ctx.pdf`，不得直连子进程。
- 所有文件路径必须过 workspace realpath 授权 + 会话作用域校验。
- Client 不直接 `fetch`，HTTP 集中在 `client/api`；只解析结构化 `pdf_*` 工具事件，不从 bash 文本猜文件。
- `shared/wire` 不依赖 Node/React/Cordis，全部值 JSON 可序列化。
- 所有 Cordis 注册走 effect 生命周期撤销；插件卸载后不得遗留路由、工具、skill provider、定时器或子进程。
- merge/discard 必须走用户明确请求 + 工具审批（`tools/pre-execute`），模型不能自行决定。

## 工具集（一期规划）

`pdf_new` / `pdf_status` / `pdf_worktree` / `pdf_edit` / `pdf_export` / `pdf_screenshot`，参照 univer 的命名与"结构化结果恢复 Client 预览目标"约定；工具结果带文件/worktree/page 标识，错误返回稳定 code（`Error [CODE]`）。

## 关键 DSH peer 依赖

`@deepseek-ai/cordis`、`@deepseek-ai/dsh-attachment`（渲染 PNG 回读给视觉模型）、`@deepseek-ai/dsh-host-webserver`、`@deepseek-ai/dsh-session`、`@deepseek-ai/dsh-skill`、`@deepseek-ai/dsh-tools`、`@deepseek-ai/schemastery`；Client 注入 `@deepseek-ai/dsh-client-runtime / -locale / -ui-conversation / -ui-sidebar`。

## 可借鉴的开源参考

- 架构与交互：`dsh-univer-office`（已安装于 `~/.dsh/profiles/web/node_modules/dsh-univer-office`，含 `docs/architecture.md`）
- 官方插件开发指南：DSH 自带 skill `cordis-plugin-development`
- 生态参考：`dsh-pdf-edit`、`@zhtx2026/dsh-pdf`、`dsh-unidoc`、`dsh-pdf-mineru`、`dsh-attachment-formats`
- 功能清单参考：Stirling-PDF（MPL-2.0）
