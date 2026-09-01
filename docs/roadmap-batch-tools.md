# PDF 批处理工具集 — 一期实施 PLAN

> 状态:已批准,待实施
> 写作者:当前 agent
> 读者:后续执行该任务的 agent(自己)
> 对齐方式:`dsh-univer-office` 的 worktree/预览/审阅范式;AGENTS.md 的引擎与架构约束。

---

## 1. 目标

参考 [iLovePDF](https://www.ilovepdf.com/zh-cn),实现一批 **PDF 批处理工具**,全部走
**隔离 worktree + 预览卡片里的"批处理工具"面板 + 一键应用** 的交互,而不是手动拖拽。

**一期范围(5 项)**:

| # | 功能 | 引擎 | 复杂度 | 备注 |
|---|---|---|---|---|
| 1 | A3 → 2×A4 切分 | pdf-lib | 中 | 把 A3 页裁剪成左右/上下两半,输出两页 A4 |
| 2 | 交替排序(固定规律,如 1,3,2,4 → 1,2,3,4) | pdf-lib(reorder_pages) | 低 | 双栏交错页序还原 |
| 3 | 合并多个 PDF | pdf-lib | 低 | 把一个或多个源 PDF 拼进当前文档 |
| 4 | 拆分 PDF(按页 / 按范围) | pdf-lib | 低 | 把某几页拆出去 |
| 5 | OCR 识别(中文) | tesseract.js | 高 | 中文起步,接受准确度/速度中等 |

**不在本期**:PDF↔Office 转换(需 LibreOffice,远期)、压缩、加密、签名。

---

## 2. 硬约束(来自 AGENTS.md,不可违反)

- 引擎全 npm、纯 JS/WASM、宽松许可证(MIT/Apache/BSD/MPL),**禁止 AGPL**。
- 引入新依赖前必须核许可证。
- 一期主力引擎是 `pdf-lib`;渲染预览用 `pdfjs-dist`。
- 所有文件路径必须过 workspace realpath 授权 + 会话作用域校验。
- 客户端不直接 fetch,HTTP 集中在 `src/client/api/pdf-api.ts`。
- merge/discard 必须走用户明确请求 + 工具审批,模型不能自行决定。

---

## 3. 用户体验原则(易用 / 准确 / 友好 — 每一项功能都必须满足)

> 这一节是硬性要求,不是软建议。任何功能如果没有过这三关,不算完成。

### 3.1 便捷(Ease of use)

- **一键应用**:批处理工具必须是"点一下按钮就完成",绝不让用户手动拖拽或分步操作。
- **最少点击**:从"看到功能"到"应用完成"不超过 2 次点击。
- **上下文到位**:工具面板就在预览卡片/缩略图旁边,不需要跳到别处。
- **可撤销**:应用后可 discard 草稿回退,不破坏原文件(worktree 已天然保证)。
- **批量友好**:能选"全部页"或"指定范围",不用一页页点。

### 3.2 准确(Accuracy)

- **结果可预览**:应用前展示"转换后缩略图/顺序"预览(如交替排序后的页序、切分后的页),
  让用户确认后再写 worktree。
- **算法正确**:每个工具必须过明确的测试样例(见 Step 3 的 N=4/N=6 样例),
  并用 `pdf_screenshot` 或 pdfjs 渲染验证切分/合并结果真实正确。
- **错误可见**:失败时给出可读的 `Error [CODE]` 信息,不静默、不闪退。
- **顺序同步**:批处理改变页序后,缩略图与可视化区保持同步(已有 `onOrderChange` 机制)。

### 3.3 友好(Friendliness)

- **文案清晰**:按钮用中文 + 简短说明,如"交替排序(1,3,2,4→1,2,3,4)"。
- **状态反馈**:应用中显示 loading/进度(如"正在切分…"),完成后有成功提示。
- **防误触**:破坏性操作(如拆分/删除)应用前二次确认。
- **空态处理**:没有选中页 / 没有源文件时给出提示,而不是报错或没反应。
- **加载态**:OCR 等耗时操作显示进度条或"正在识别…",避免无反馈假死。

### 3.4 验收自查清单(每个功能都要过)

- [ ] 一键触发,≤2 次点击完成
- [ ] 应用前有可确认的预览/说明
- [ ] 结果用测试样例验证过正确
- [ ] 失败有可读错误,不静默
- [ ] loading / 完成 / 空态 / 防误触 都有处理

---

## 4. 架构分层(必须遵循)


```
webServer/tools → service ← provider → (adapters)
                      ↑
                 client api (pdf-api.ts)
                      ↑
              client 工具面板 (preview-card / pdf-preview)
```

- **Provider 是唯一能组合文件操作的层**(`src/host/provider/`)。
- **webServer 和 Tools 只能调 `ctx.pdf`**,不得直连子进程。
- `shared/wire` 不依赖 Node/React/Cordis,值 JSON 可序列化。
- 客户端只解析结构化 `pdf_*` 工具事件,不从 bash 文本猜文件。

---

## 5. 分步实施顺序(给未来的我)

> 每一步都要:改完 → `pnpm run typecheck` → 走通 → 再下一步。构建用 **Node 22+**
> (`PATH` 里的 `/usr/local/bin/node` 是 v20 不可用,必须用
> `$HOME/.nvm/versions/node/v26.1.0/bin/node`)。

### Step 1 — 服务端编辑命令(pdf-lib)

在 `src/host/provider/pdf-operations.ts` 的 `applyEdits` 循环里新增命令分支。
注意 `reorder_pages`(交替排序的基底)已存在,无需重做。

新增两个 kind(需同步改 3 处):
1. `src/host/service/types.ts` — `PdfEditCommand` 联合类型加:
   - `split_pages { pages: number[]; direction?: 'vertical'|'horizontal' }`
   - `merge_pages { sources: string[]; atPage?: number }`
2. `src/host/provider/pdf-operations.ts` — `applyEdits` 里实现两个分支。
3. `src/host/tools/definitions/edit.ts` — kind 枚举 + 字段描述 + 命令解析分支。

**split_pages 实现要点**:
- 用 `document.copyPages` 复制目标页两次,各自 `setMediaBox`/`setCropBox` 裁剪为半幅。
- vertical:A3 横版左右各一半;horizontal:上下各一半。
- 重建 document(`PDFDocument.create()` + addPage),因为 copyPages 需要新文档。

**merge_pages 实现要点**:
- 对每个 `sourceFile`:`readFile` → `loadDocument` → `copyPages` 全部页。
- 默认追加到末尾;`atPage` 指定插入位置。

### Step 2 — webServer 路由

`src/host/webServer/router.ts`:`/pdf-api/edit` 已存在,直接复用(edit 命令已透传)。
无需新路由(除非做 OCR 的独立端点)。

### Step 3 — 客户端 API

`src/client/api/pdf-api.ts`:
- `applyManualEdits` 已存在,可复用。
- 加一个纯函数 `buildAlternateMergeOrder(count)`:
  - 输入页数 N,输出交替排序后的 `reorder_pages` order 数组。
  - **算法需在实施时用真实验证**:双栏交错(左栏 1,2;右栏 3,4 → 排列 1,3,2,4)
    还原为 1,2,3,4。给出明确测试样例:
    - N=4 → order `[1,3,2,4]`
    - N=6 → order `[1,4,2,5,3,6]`(左栏 1,2,3;右栏 4,5,6 交错)
  - 注意 reorder_pages 的 `order` 语义 = **新的页面顺序数组**(1-based)。

### Step 4 — 客户端"批处理工具"面板

在预览组件里加一个"批处理工具"面板(放 `pdf-preview.tsx` 或 `preview-card.tsx`):
- **交替排序**:按钮 → 算出 order → `applyManualEdits([{kind:'reorder_pages', order}])`
- **A3→A4 切分**:按钮 → 对指定页 `applyManualEdits([{kind:'split_pages', pages, direction}])`
- **合并**:选源文件 → `applyManualEdits([{kind:'merge_pages', sources}])`
- **拆分**:选页/范围 → `applyManualEdits`(用 delete + export,或独立命令)
- 每个按钮应用后:刷新预览 + 让缩略图顺序同步(`onOrderChange`)。

样式:延续 `pdf-preview` / toolbox 的样式风格(`src/client/styles/worktree.ts`)。

### Step 5 — OCR(tesseract.js)

1. **先核许可证**:`tesseract.js` 是 Apache-2.0 ✅(符合 AGENTS.md)。
   `pnpm add tesseract.js` 前确认版本。
2. 服务端能力 `src/host/provider/ocr-operations.ts`:
   - 用 pdfjs-dist 把目标页渲染成图(pdfjs 已内置),再喂给 tesseract.js 识别中文。
   - 中文语言数据 `chi_sim`。注意 tesseract.js WASM 在 Node 下的 worker 配置。
3. 工具定义 + webServer 端点:`pdf_ocr` 工具。
4. 客户端:工具面板加"OCR 识别"按钮,展示识别文本。

**性能提示**:tesseract.js 单线程较慢,大文档先做单页或前几页,避免卡死。

---

## 6. 关键风险 / 决策点

- **交替排序算法语义**:必须先用测试样例(N=4, N=6)验证 order 方向,再做 UI。
- **split_pages 的 MediaBox 坐标**:pdf-lib 坐标原点在左下,y 向上;切分时注意
  horizontal 的上下半区 y 值。用 `pdf_screenshot` 或 pdfjs 渲染验证切分结果。
- **OCR 性能**:中文 WASM 慢,一期接受"准度中等、速度一般",后续可评估替代
  (ocrs-cjk / 外部 API)——但换引擎需用户确认,不能擅自。
- **拆分 PDF 的落地方案**:优先考虑「把目标页复制到新 worktree 草稿」而非直接删原页,
  避免破坏原文档。用 `pdf_new` + 复制页 实现。

---

## 7. 完成定义(DoD)

- [ ] 5 个功能都能通过 `pdf_edit` / 新工具在草稿上应用,不崩
- [ ] 每个功能在预览卡片/工具面板可一键触发,缩略图顺序同步
- [ ] OCR 能对中文 PDF 页返回文本
- [ ] `pnpm run typecheck` ✅、`pnpm run build` ✅(Node 26)
- [ ] 服务端 bundle 与本地一致,部署到运行中的 DSH web(127.0.0.1:3080)
- [ ] 端到端走一遍工作流,预览卡片正常渲染

---

## 8. 环境与已验证事实(自包含,勿依赖历史会话)

以下事实在开发本插件时已确认,直接复用,不必重新排查:

### 构建环境
- **必须用 Node 26**:`$HOME/.nvm/versions/node/v26.1.0/bin/node`。
  `PATH` 里的 `/usr/local/bin/node` 是 v20,**pnpm 会因 `node:sqlite` 缺失而崩**。
  构建命令:`"$HOME/.nvm/versions/node/v26.1.0/bin/node" scripts/build.mjs`。
- typecheck:`"$NODE26" node_modules/typescript/bin/tsc --project tsconfig.json --noEmit`
  + `tsconfig.client.json`。

### 运行中的 DSH web
- 地址:`http://127.0.0.1:3080`。
- 插件 client bundle 由 webServer 动态从 `lib/client.js` 读,改完 build 后
  **浏览器硬刷新(Cmd+Shift+R)** 生效,无需重启 webServer。
- 校验:`curl http://127.0.0.1:3080/plugins/dsh-pdf-maker/client.js` 应与本地 `lib/client.js` 一致。
- worker 路由:`/pdf-api/pdf.worker.mjs`(已存在,200)。

### pdfjs 集成要点(已踩过的坑,勿重踩)
- pdfjs-dist v6 在模块顶层访问 `Iterator.prototype.join`,旧浏览器无 `Iterator` 会崩。
  **已在 build 时注入 Iterator shim**,勿移除。
- `PDFViewer` 构造要求:`container` 和内部 `viewer` 都必须是 `<div>`,且 container
  `position: absolute`。否则抛 `Invalid container and/or viewer option`。
  见 `src/client/components/pdf-viewer-panel.tsx`。
- 页码翻页在滚动模式下用 `currentPageLabel`,`currentPageNumber` 不生效。

### 预览双形态(已实现,勿破坏)
- `src/client/components/pdf-preview.tsx`:
  - **缩略图模式**:页面缩略图网格 + 拖拽排序,松手写 worktree。
  - **完整模式**:pdfjs `PDFViewer` + 翻页/缩放/适配。
  - 顶部「缩略图 / 完整预览」切换;按操作类型自动推荐 + 手动覆盖。
- 缩略图与可视化区通过 `externalOrder` / `onOrderChange` 双向同步。
- 「页面管理与重排」已删除,排序由缩略图完成。

### 会话场景
- 测试文件:`sample-report.pdf`(4 页 A4,工作区根目录)。
- 已建大量 worktree,测试时新建一个即可(名称随意,如"测试")。

---

## 9. 参考

- AGENTS.md:引擎选型、架构约束、工具集、许可证
- `docs/architecture.md`:架构
- iLovePDF:https://www.ilovepdf.com/zh-cn
- 参考插件:`dsh-univer-office`(~/.dsh/profiles/web/node_modules/dsh-univer-office)
