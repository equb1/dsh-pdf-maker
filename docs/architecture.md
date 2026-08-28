# dsh-pdf-maker 架构

状态：草稿（skeleton）
日期：2026-08-28

本插件是 DeepSeek Harness（DSH）的 PDF 编辑插件，交互范式对齐
`dsh-univer-office`：Agent 创建隔离草稿 worktree → 实时预览 → 会话审阅卡片 →
用户明确确认后 merge / discard。项目开源在 GitHub，MIT 许可。

## 1. 结构

单 npm 包，多个 Cordis 插件角色：

- `service`：稳定的 PDF 领域接口（`PdfService`）；
- `provider`：实现接口，拥有 worktree 操作、PDF 编辑操作与 Gateway Supervisor；
- `webServer`：把浏览器访问能力映射为 Host HTTP API（`/pdf-api`）；
- `tools`：把模型可调用的 PDF 能力映射为 `pdf_*` 工具；
- `skills`：向 DSH Skill Registry 提供按需加载的 PDF 工作流；
- `processes/gateway`：内置 Gateway 子进程的生命周期管理；
- `gateway-app`：Gateway 子进程入口（当前仅健康检查）；
- `client`：DSH 浏览器端的回合尾部审阅卡片与预览投影；
- `shared/wire`：Host 与 Client 共享的纯 JSON 数据类型。

## 2. 信任边界

Host 是可信的 Node.js 进程，负责文件访问、worktree 操作、PDF 编辑与 Gateway
管理。Client 是浏览器模块，只能通过 `/pdf-api/*` 访问 Host，不读本地文件、
不启动进程。所有文件路径必须通过 workspace realpath 授权 + 会话作用域校验。

## 3. Worktree 领域模型

- 草稿 = workspace 内隐藏目录 `.dsh-pdf-maker/worktrees/<slug>/<id>/` 中的 PDF 副本；
- `edit` 只写 draft 副本并置为 `ready`；
- `merge` 用 draft 副本覆盖 trunk 文件并置终态 `merged`；
- `discard` 删除 draft 目录并置终态 `discarded`；
- `ready` / `reopen` 只切换 `draft` / `ready` 状态。

## 4. 引擎选型（AGENTS.md 已定，勿改）

| 用途 | 引擎 | 许可证 |
|---|---|---|
| 渲染 + 文本提取 | `pdfjs-dist` | Apache-2.0 |
| 结构编辑 + 注释 + 表单 | `pdf-lib` | MIT |
| 中文字体嵌入 | `fontkit` + 系统字体发现 | MIT / OFL |
| 结构级操作补刀 | `qpdf-wasm` | Apache-2.0 |
| 内容级编辑（二期） | PDFium WASM | BSD/MIT |
| OCR（可选） | `tesseract.js` | Apache-2.0 |
| Office 扩展（远期） | LibreOffice headless | MPL-2.0 |

禁止引入 AGPL 依赖（MuPDF / Ghostscript / ONLYOFFICE）与要求 JVM / Python 运行时
的引擎。

## 5. 构建

`pnpm run build` 用 esbuild 生成：

- `lib/index.js`（Host，DSH peer 依赖保持 external）；
- `lib/client.js`（浏览器 bundle，经 `window.__ModuleLoader__.load` 包装）；
- `artifacts/gateway.cjs`（Gateway 子进程）。

## 6. 一期 Roadmap

- 已搭：worktree 生命周期、`pdf_new/status/worktree/edit/export` 工具、浏览器
  API、Client 回合尾部卡片、Skill、构建。
- 待做：Gateway 内嵌 pdf.js Viewer 与渲染（`pdf_screenshot`）、OCR、范式 C
  往返重建（PDF → 可编辑中间格式 → 重渲染）、Office 格式扩展。
