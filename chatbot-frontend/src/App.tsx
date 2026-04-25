import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

type Role = 'user' | 'ai' | 'system'

type ProgressStage = {
  key: string
  label: string
  percent: number
  status: 'pending' | 'active' | 'done'
  message?: string
}

type ChatMessage = {
  id: string
  role: Role
  content: string
  createdAt: string
  progress?: ProgressStage[]
}

type SseEvent =
  | { type: 'progress'; stage: string; percent: number; message: string }
  | { type: 'report'; content: string }
  | { type: 'diagnosis'; content: string; delta: string }
  | { type: 'error'; message: string }
  | { type: 'done' }

const INVITE_STORAGE_KEY = 'guiagent:invite-verified'
const VALID_INVITES = ['MED-2026', 'GUIAGENT', 'RAD-AI-01', 'DICOM-LAB']

const PROGRESS_TEMPLATE: ProgressStage[] = [
  { key: 'report', label: '📋 提取报告中...', percent: 0, status: 'pending' },
  { key: 'capture', label: '🖼️ 采集影像中...', percent: 0, status: 'pending' },
  { key: 'dicom', label: '🔄 重建 DICOM 中...', percent: 0, status: 'pending' },
  { key: 'model', label: '🔬 AI 模型分析中...', percent: 0, status: 'pending' },
  { key: 'diagnosis', label: '🩺 生成诊断报告中...', percent: 0, status: 'pending' },
]

const conversations = [
  { id: 'today', title: '今日分析', meta: '医学影像链接' },
  { id: 'demo', title: '胸部 CT 复查', meta: '模拟病例' },
  { id: 'archive', title: '历史报告草稿', meta: '3 条消息' },
]

const welcomeMessages: ChatMessage[] = [
  {
    id: crypto.randomUUID(),
    role: 'ai',
    content:
      '你好，我是医学影像 AI 助手。你可以直接输入问题，也可以粘贴医学影像分享链接，我会按流程提取报告、采集影像、重建 DICOM 并生成结构化诊断建议。',
    createdAt: '刚刚',
  },
]

function App() {
  const [isVerified, setIsVerified] = useState(
    () => localStorage.getItem(INVITE_STORAGE_KEY) === 'true',
  )
  const [inviteCode, setInviteCode] = useState('')
  const [inviteError, setInviteError] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>(welcomeMessages)
  const [draft, setDraft] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const detectedLink = useMemo(() => extractFirstUrl(draft), [draft])

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages])

  async function handleInviteSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalizedCode = inviteCode.trim().toUpperCase()

    if (!normalizedCode) {
      setInviteError('请输入邀请码')
      return
    }

    const isValid = await verifyInvite(normalizedCode)
    if (!isValid) {
      setInviteError('邀请码无效，请检查后重试')
      return
    }

    localStorage.setItem(INVITE_STORAGE_KEY, 'true')
    setIsVerified(true)
    setInviteError('')
  }

  async function handleSendMessage(content = draft.trim()) {
    if (!content || isStreaming) return

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      createdAt: '刚刚',
    }

    setMessages((current) => [...current, userMessage])
    setDraft('')
    await runChatFlow(content)
  }

  async function runChatFlow(content: string) {
    setIsStreaming(true)

    const progressId = crypto.randomUUID()
    const aiId = crypto.randomUUID()

    setMessages((current) => [
      ...current,
      {
        id: progressId,
        role: 'system',
        content: '系统正在处理医学影像任务',
        createdAt: '处理中',
        progress: PROGRESS_TEMPLATE.map((stage) => ({ ...stage })),
      },
      {
        id: aiId,
        role: 'ai',
        content: '',
        createdAt: '生成中',
      },
    ])

    try {
      for await (const event of streamChatEvents(content)) {
        if (event.type === 'progress') {
          setMessages((current) =>
            updateProgressMessage(current, progressId, event.stage, event.percent, event.message),
          )
        }

        if (event.type === 'report') {
          setMessages((current) =>
            appendAiContent(current, aiId, `### 原始报告提取\n${event.content}\n\n`),
          )
        }

        if (event.type === 'diagnosis') {
          setMessages((current) => appendAiContent(current, aiId, event.delta))
        }

        if (event.type === 'error') {
          setMessages((current) =>
            appendAiContent(current, aiId, `\n\n> 处理失败：${event.message}`),
          )
        }
      }
    } finally {
      setMessages((current) =>
        current.map((message) =>
          message.id === aiId ? { ...message, createdAt: '刚刚' } : message,
        ),
      )
      setIsStreaming(false)
    }
  }

  if (!isVerified) {
    return (
      <main className="invite-screen">
        <section className="invite-panel" aria-labelledby="invite-title">
          <div className="brand-mark">AI</div>
          <p className="eyebrow">GUIAgent Medical Workspace</p>
          <h1 id="invite-title">进入医学影像智能诊断助手</h1>
          <p className="invite-copy">
            请输入内测邀请码。当前前端已内置临时验证，后续可无缝切换到
            <code>/api/verify-invite</code>。
          </p>

          <form className="invite-form" onSubmit={handleInviteSubmit}>
            <label htmlFor="invite-code">邀请码</label>
            <div className="invite-input-row">
              <input
                id="invite-code"
                value={inviteCode}
                onChange={(event) => setInviteCode(event.target.value)}
                placeholder="例如 MED-2026"
                autoComplete="off"
              />
              <button type="submit">验证进入</button>
            </div>
            {inviteError && <p className="form-error">{inviteError}</p>}
          </form>

          <p className="hint">可用测试码：MED-2026 / GUIAGENT / RAD-AI-01</p>
        </section>
      </main>
    )
  }

  return (
    <main className="chat-shell">
      <aside className="sidebar" aria-label="历史对话">
        <div className="sidebar-header">
          <div className="brand-mark small">AI</div>
          <div>
            <strong>MedChat</strong>
            <span>影像诊断助手</span>
          </div>
        </div>

        <button className="new-chat-button" type="button" onClick={() => setMessages(welcomeMessages)}>
          + 新对话
        </button>

        <nav className="history-list">
          {conversations.map((conversation, index) => (
            <button
              className={index === 0 ? 'history-item active' : 'history-item'}
              key={conversation.id}
              type="button"
            >
              <span>{conversation.title}</span>
              <small>{conversation.meta}</small>
            </button>
          ))}
        </nav>
      </aside>

      <section className="chat-main">
        <header className="chat-header">
          <div>
            <p className="eyebrow">Clinical Imaging Copilot</p>
            <h1>医学影像对话分析</h1>
          </div>
          <button
            className="logout-button"
            type="button"
            onClick={() => {
              localStorage.removeItem(INVITE_STORAGE_KEY)
              setIsVerified(false)
            }}
          >
            退出
          </button>
        </header>

        <div className="message-list" ref={scrollRef}>
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
        </div>

        <div className="composer-wrap">
          {detectedLink && (
            <div className="link-detected">
              <span>🔗 检测到医学影像链接，是否开始分析？</span>
              <button type="button" onClick={() => handleSendMessage(detectedLink)}>
                开始分析
              </button>
            </div>
          )}

          <form
            className="composer"
            onSubmit={(event) => {
              event.preventDefault()
              handleSendMessage()
            }}
          >
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="输入问题，或粘贴医学影像链接..."
              rows={1}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  handleSendMessage()
                }
              }}
            />
            <button type="submit" disabled={!draft.trim() || isStreaming}>
              {isStreaming ? '分析中' : '发送'}
            </button>
          </form>
        </div>
      </section>
    </main>
  )
}

function MessageBubble({ message }: { message: ChatMessage }) {
  return (
    <article className={`message ${message.role}`}>
      <div className="avatar">{message.role === 'user' ? '我' : message.role === 'ai' ? 'AI' : '进'}</div>
      <div className="bubble">
        {message.progress ? (
          <ProgressPanel stages={message.progress} />
        ) : (
          <div
            className="markdown"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content || '正在生成...') }}
          />
        )}
      </div>
    </article>
  )
}

function ProgressPanel({ stages }: { stages: ProgressStage[] }) {
  const current = stages.find((stage) => stage.status === 'active') ?? stages.at(-1)

  return (
    <div className="progress-panel">
      <div className="progress-summary">
        <span>{current?.message ?? current?.label}</span>
        <strong>{Math.round(current?.percent ?? 0)}%</strong>
      </div>
      <div className="progress-track">
        <span style={{ width: `${current?.percent ?? 0}%` }} />
      </div>
      <ol className="stage-list">
        {stages.map((stage) => (
          <li className={stage.status} key={stage.key}>
            <span>{stage.message ?? stage.label}</span>
            <small>{stage.status === 'done' ? '完成' : `${Math.round(stage.percent)}%`}</small>
          </li>
        ))}
      </ol>
    </div>
  )
}

async function verifyInvite(code: string) {
  if (VALID_INVITES.includes(code)) return true

  try {
    const response = await fetch('/api/verify-invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })

    if (!response.ok) return false
    const data = (await response.json()) as { valid?: boolean }
    return Boolean(data.valid)
  } catch {
    return false
  }
}

async function* streamChatEvents(content: string): AsyncGenerator<SseEvent> {
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: content }),
    })

    if (!response.ok || !response.body) throw new Error('API unavailable')
    yield* parseSseStream(response.body)
  } catch {
    yield* mockChatEvents(content)
  }
}

async function* parseSseStream(body: ReadableStream<Uint8Array>): AsyncGenerator<SseEvent> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const chunks = buffer.split('\n\n')
    buffer = chunks.pop() ?? ''

    for (const chunk of chunks) {
      const eventLine = chunk.split('\n').find((line) => line.startsWith('event:'))
      const dataLine = chunk.split('\n').find((line) => line.startsWith('data:'))
      if (!eventLine || !dataLine) continue

      const type = eventLine.replace('event:', '').trim()
      const data = JSON.parse(dataLine.replace('data:', '').trim())
      yield { type, ...data } as SseEvent
    }
  }
}

async function* mockChatEvents(content: string): AsyncGenerator<SseEvent> {
  const events: SseEvent[] = [
    { type: 'progress', stage: 'report', percent: 18, message: '📋 提取报告中...' },
    { type: 'report', content: '已识别影像链接，模拟提取到检查类型：胸部 CT 平扫。报告文本质量良好。' },
    { type: 'progress', stage: 'capture', percent: 38, message: '🖼️ 采集影像中 (32/150)...' },
    { type: 'progress', stage: 'dicom', percent: 58, message: '🔄 重建 DICOM 中...' },
    { type: 'progress', stage: 'model', percent: 78, message: '🔬 AI 模型分析中...' },
    { type: 'progress', stage: 'diagnosis', percent: 92, message: '🩺 生成诊断报告中...' },
    { type: 'done' },
  ]

  for (const event of events.slice(0, -1)) {
    await wait(520)
    yield event
  }

  const diagnosis = [
    '### AI 诊断建议\n',
    '- 双肺纹理显示清晰，未见明确大片实变影。\n',
    '- 右下肺可疑小结节影，建议结合薄层重建与既往影像对比。\n',
    '- 纵隔结构居中，未见明显胸腔积液征象。\n\n',
    `**输入来源**：${extractFirstUrl(content) ? '医学影像链接' : '文本问诊'}\n\n`,
    '> 结果为前端模拟流式输出，仅用于界面联调，不能替代医生诊断。',
  ].join('')

  for (const char of diagnosis) {
    await wait(18)
    yield { type: 'diagnosis', content: diagnosis, delta: char }
  }

  yield { type: 'progress', stage: 'diagnosis', percent: 100, message: '🩺 生成诊断报告中...' }
  yield { type: 'done' }
}

function updateProgressMessage(
  messages: ChatMessage[],
  id: string,
  activeStage: string,
  percent: number,
  message: string,
) {
  const activeIndex = PROGRESS_TEMPLATE.findIndex((stage) => stage.key === activeStage)

  return messages.map((item) => {
    if (item.id !== id || !item.progress) return item

    return {
      ...item,
      progress: item.progress.map((stage, index) => ({
        ...stage,
        percent: index < activeIndex ? 100 : stage.key === activeStage ? percent : stage.percent,
        status: (
          index < activeIndex ? 'done' : stage.key === activeStage ? 'active' : 'pending'
        ) as ProgressStage['status'],
        message: stage.key === activeStage ? message : stage.message,
      })),
    }
  })
}

function appendAiContent(messages: ChatMessage[], id: string, delta: string) {
  return messages.map((message) =>
    message.id === id ? { ...message, content: `${message.content}${delta}` } : message,
  )
}

function extractFirstUrl(value: string) {
  return value.match(/https?:\/\/[^\s]+/i)?.[0] ?? ''
}

function renderMarkdown(markdown: string) {
  const escaped = markdown
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  return escaped
    .replace(/^### (.*)$/gm, '<h3>$1</h3>')
    .replace(/^## (.*)$/gm, '<h2>$1</h2>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/^- (.*)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
    .replace(/^&gt; (.*)$/gm, '<blockquote>$1</blockquote>')
    .replace(/\n/g, '<br />')
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

export default App
