import assert from 'node:assert'
import { readFile } from 'node:fs/promises'
import * as React from 'react'

// Mock global browser objects for client tests
let loadedClient = null
const mockLoader = {
  load: (registration) => {
    loadedClient = registration
  },
}
globalThis.document = {
  querySelector: () => null,
  head: { appendChild: () => {} },
  createElement: () => ({
    setAttribute: () => {},
    textContent: '',
    dataset: {},
  }),
}
globalThis.window = {
  location: { origin: 'http://127.0.0.1:3080' },
  __ModuleLoader__: mockLoader,
  document: globalThis.document,
}
globalThis.__ModuleLoader__ = mockLoader

// Read and execute lib/client.js in global context
const clientBundleSource = await readFile(
  new URL('../lib/client.js', import.meta.url),
  'utf8',
)
const runner = new Function(clientBundleSource)
runner()

assert.ok(
  loadedClient !== null,
  'lib/client.js must register with __ModuleLoader__',
)
assert.strictEqual(loadedClient.id, 'dsh-pdf-maker')

// Create mock DSH client context
let registeredTurnDef = null
const registeredSlots = []
let registeredLocale = null

const mockCtx = {
  slots: {
    inject: (slotName, fn) => fn(),
    register: (opts, comp) => {
      registeredSlots.push({ opts, comp })
    },
  },
  locale: {
    register: (ns, dicts) => {
      registeredLocale = { ns, dicts }
    },
  },
  conversationEvents: {
    register: (def) => {
      registeredTurnDef = def
    },
  },
  effect: (fn) => fn(),
}

const mockRequire = (id) => {
  if (id === 'react') return React
  return {}
}

const pluginExports = loadedClient.factory(mockRequire)
assert.ok(
  typeof pluginExports.apply === 'function',
  'Plugin must export apply()',
)

// Apply plugin to mock context
pluginExports.apply(mockCtx)

assert.ok(registeredTurnDef !== null, 'pdfTurnDefinition must be registered')
assert.strictEqual(registeredTurnDef.kind, 'pdfTurn')

// 2. Test turn events reducer
let state = registeredTurnDef.start(
  {},
  { event: { type: 'turn/start', data: { turn: 1 } } },
)

// 2.1 Tool call: pdf_status (with JSON string arguments like real DSH)
state = registeredTurnDef.update(
  { state },
  {
    event: {
      type: 'tool/call',
      data: {
        turn: 1,
        callId: 'call_status_1',
        name: 'pdf_status',
        arguments: JSON.stringify({ file: 'demo/source/contract.pdf' }),
      },
    },
  },
)

// 2.2 Tool call: pdf_worktree create
state = registeredTurnDef.update(
  { state },
  {
    event: {
      type: 'tool/call',
      data: {
        turn: 1,
        callId: 'call_wt_1',
        name: 'pdf_worktree',
        arguments: JSON.stringify({
          file: 'demo/source/contract.pdf',
          action: 'create',
          name: '合同终审-李四',
        }),
      },
    },
  },
)

// 2.3 Tool call: pdf_edit
state = registeredTurnDef.update(
  { state },
  {
    event: {
      type: 'tool/call',
      data: {
        turn: 1,
        callId: 'call_edit_1',
        name: 'pdf_edit',
        arguments: JSON.stringify({
          file: 'demo/source/contract.pdf',
          worktreeId: 'wt_test_99',
          edits: [
            {
              kind: 'form',
              page: 1,
              fieldName: 'contract_no',
              value: 'HT-2026-9901',
            },
          ],
        }),
      },
    },
  },
)

// 2.4 Tool results
state = registeredTurnDef.update(
  { state },
  {
    event: {
      type: 'tool/result',
      data: {
        turn: 1,
        message: { content: [{ toolCallId: 'call_edit_1', isError: false }] },
      },
    },
  },
)

assert.strictEqual(
  state.files.length,
  1,
  'Expected 1 target file in turn state',
)
assert.strictEqual(state.files[0].file, 'demo/source/contract.pdf')
assert.strictEqual(state.files[0].operations.length, 3)

// 3. Test buildLocationData & turnTail slot selection
const locationData = registeredTurnDef.buildLocationData({ state }, 'turn')
assert.strictEqual(locationData.key, 'pdfTurn')

const turnTailSlot = registeredSlots.find(
  (s) => s.opts.name === 'conversation.chat.turnTail',
)
assert.ok(turnTailSlot !== null, 'turnTail slot must be registered')

const turnDataMap = new Map()
turnDataMap.set('pdfTurn', locationData.value)
const matchedProps = turnTailSlot.opts.select({
  turn: { turn: 1, data: turnDataMap },
})
assert.ok(matchedProps !== null, 'select function must match pdf turn')
assert.strictEqual(matchedProps.files.length, 1)

// 4. Test PreviewCard Component instantiation
const PreviewCard = turnTailSlot.comp
const cardElement = PreviewCard({
  turn: { turn: 1, data: turnDataMap },
  sessionId: 'session-test-123',
})

assert.ok(cardElement !== null, 'PreviewCard element must not be null')
assert.strictEqual(cardElement.props['data-plugin'], 'dsh-pdf-maker')
assert.strictEqual(cardElement.props.className, 'pdf-preview-card')

const fileItemEl = cardElement.props.children[0]
assert.strictEqual(fileItemEl.props.fileItem.file, 'demo/source/contract.pdf')

// Provide ReactCurrentDispatcher mock so component can execute hooks in test environment
React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher.current =
  {
    useState: (initial) => [
      typeof initial === 'function' ? initial() : initial,
      () => {},
    ],
    useCallback: (fn) => fn,
    useEffect: () => {},
  }

const renderedItem = fileItemEl.type(fileItemEl.props)
const [headerEl, viewerEl, opsEl, errorEl, actionsEl] =
  renderedItem.props.children

assert.strictEqual(headerEl.props.className, 'pdf-header')
assert.strictEqual(viewerEl.props.className, 'pdf-viewer-container')
assert.strictEqual(viewerEl.props.children.props.className, 'pdf-viewer-iframe')
assert.ok(
  viewerEl.props.children.props.src.includes(
    '/pdf-api/content?file=demo%2Fsource%2Fcontract.pdf',
  ),
)
assert.strictEqual(actionsEl.props.className, 'pdf-actions')
assert.strictEqual(actionsEl.props.children.length, 2)
assert.ok(actionsEl.props.children[0].props.children.includes('Discard'))
assert.ok(actionsEl.props.children[1].props.children.includes('Merge'))

console.log('✅ 自测全部通过：')
console.log(
  '  1. lib/client.js 成功注册 __ModuleLoader__ 命名空间 dsh-pdf-maker',
)
console.log(
  '  2. pdfTurn 状态归约成功捕获 3 次工具调用（pdf_status / pdf_worktree / pdf_edit）',
)
console.log(
  '  3. selectPdfTurn 精准命中回合尾部插槽 (conversation.chat.turnTail)',
)
console.log('  4. PreviewCard 成功构造完整视图树：')
console.log('     - 目标文件:', fileItemEl.props.fileItem.file)
console.log('     - 实时预览流 URL:', viewerEl.props.children.props.src)
console.log(
  '     - 审批按钮:',
  actionsEl.props.children.map((b) => b.props.children),
)
