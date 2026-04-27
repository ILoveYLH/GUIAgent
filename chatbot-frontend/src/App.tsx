import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { marked } from 'marked'
import './App.css'

type Role = 'user' | 'ai' | 'system'
type FindingCategory = 'lung' | 'rib' | 'bone' | 'lymph'

type ProgressStage = {
  key: string
  label: string
  percent: number
  status: 'pending' | 'active' | 'done'
  message?: string
}

type Finding = {
  findingUid: string
  type: string
  location: string
  dangerStr?: string
  sliceIndex?: number
  size?: number[]
  hu?: number
  boundingBox?: { x: number; y: number }[]
  category: FindingCategory
  probability?: number
  description?: string
}

type ChatMessage = {
  id: string
  role: Role
  content: string
  createdAt: string
  progress?: ProgressStage[]
  findings?: Finding[]
  modelSummary?: string
  frameBaseUrl?: string
  totalFrames?: number
}

type Conversation = {
  id: string
  title: string
  created_at: string
  updated_at: string
  message_count: number
  last_message_preview?: string
  last_message_at?: string
}

type StoredMessage = {
  id: string
  role: Role
  content: string
  message_type: 'text' | 'progress' | 'report' | 'findings' | 'diagnosis'
  metadata?: Record<string, unknown>
  created_at: string
}

type StoredConversation = Conversation & {
  messages: StoredMessage[]
}

type SseEvent =
  | { type: 'init'; conversation_id: string }
  | { type: 'title'; conversation_id: string; title: string }
  | { type: 'progress'; stage: string; percent: number; message: string }
  | { type: 'report'; content: string }
  | { type: 'findings'; data: ModelResult; frame_base_url: string; total_frames?: number }
  | { type: 'diagnosis'; delta: string }
  | { type: 'error'; message: string }
  | { type: 'done' }

type ModelResult = {
  report?: { summary?: string; detail?: string }
  lung_lesions?: Record<string, unknown>[]
  rib_lesions?: Record<string, unknown>[]
  bone_metastasis_lesions?: Record<string, unknown>[]
  lymphnode_lesions?: Record<string, unknown>[]
}

const INVITE_STORAGE_KEY = 'guiagent:invite-verified'
const TOKEN_STORAGE_KEY = 'guiagent:auth-token'
const VALID_INVITES = ['MED-2026', 'GUIAGENT', 'RAD-AI-01', 'DICOM-LAB']

const PROGRESS_TEMPLATE: ProgressStage[] = [
  { key: 'report', label: '提取报告中...', percent: 0, status: 'pending' },
  { key: 'capture', label: '采集影像中...', percent: 0, status: 'pending' },
  { key: 'dicom', label: '重建 DICOM 中...', percent: 0, status: 'pending' },
  { key: 'model', label: 'AI 模型分析中...', percent: 0, status: 'pending' },
  { key: 'diagnosis', label: '生成诊断报告中...', percent: 0, status: 'pending' },
]

function makeWelcomeMessages(): ChatMessage[] {
  return [{
    id: crypto.randomUUID(),
    role: 'ai',
    content:
      '你好，我是医学影像 AI 助手。你可以直接输入问题，也可以粘贴医学影像分享链接，我会按流程提取报告、采集影像、重建 DICOM 并生成结构化诊断建议。',
    createdAt: '刚刚',
  }]
}

marked.setOptions({
  gfm: true,
  breaks: true,
})

function App() {
  const [authToken, setAuthToken] = useState(() => {
    const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY) ?? ''
    return storedToken === 'offline' ? '' : storedToken
  })
  const [isVerified, setIsVerified] = useState(() => {
    const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY) ?? ''
    return localStorage.getItem(INVITE_STORAGE_KEY) === 'true' && Boolean(storedToken) && storedToken !== 'offline'
  })
  const [inviteCode, setInviteCode] = useState('')
  const [inviteError, setInviteError] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>(() => makeWelcomeMessages())
  const [conversationList, setConversationList] = useState<Conversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [draft, setDraft] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const detectedLink = useMemo(() => extractFirstUrl(draft), [draft])
  const groupedConversations = useMemo(
    () => groupConversationsByDate(conversationList),
    [conversationList],
  )

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages])

  useEffect(() => {
    if (!isVerified) return
    refreshConversationList()
  }, [isVerified])

  async function handleInviteSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalizedCode = inviteCode.trim().toUpperCase()

    if (!normalizedCode) {
      setInviteError('请输入邀请码')
      return
    }

    const token = await verifyInvite(normalizedCode)
    if (!token) {
      setInviteError('邀请码无效，请检查后重试')
      return
    }

    localStorage.setItem(INVITE_STORAGE_KEY, 'true')
    localStorage.setItem(TOKEN_STORAGE_KEY, token)
    setAuthToken(token)
    setIsVerified(true)
    setInviteError('')
  }

  async function refreshConversationList() {
    try {
      const list = await fetchConversationList()
      setConversationList(list)
    } catch {
      setConversationList([])
    }
  }

  async function handleNewConversation() {
    const conversation = await createConversation()
    setConversationList((current) => [conversation, ...current.filter((item) => item.id !== conversation.id)])
    setActiveConversationId(conversation.id)
    setMessages(makeWelcomeMessages())
  }

  async function handleSelectConversation(id: string) {
    if (isStreaming) return
    setActiveConversationId(id)
    const conversation = await fetchConversation(id)
    setMessages(conversation.messages.length ? conversation.messages.map(mapStoredMessage) : makeWelcomeMessages())
  }

  async function handleDeleteConversation(id: string) {
    await deleteConversation(id)
    setConversationList((current) => current.filter((conversation) => conversation.id !== id))
    if (activeConversationId === id) {
      setActiveConversationId(null)
      setMessages(makeWelcomeMessages())
    }
  }

  async function submitTitle(id: string) {
    const title = editingTitle.trim()
    setEditingTitleId(null)
    if (!title) return
    await updateConversationTitle(id, title)
    setConversationList((current) =>
      current.map((conversation) => (conversation.id === id ? { ...conversation, title } : conversation)),
    )
  }

  async function handleSendMessage(content = draft.trim()) {
    if (!content || isStreaming) return
    if (!authToken) {
      localStorage.removeItem(INVITE_STORAGE_KEY)
      localStorage.removeItem(TOKEN_STORAGE_KEY)
      setIsVerified(false)
      setInviteError('登录已过期，请重新输入邀请码')
      return
    }

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
    const hasLink = Boolean(extractFirstUrl(content))

    setMessages((current) => {
      const next = [...current]
      if (hasLink) {
        next.push({
          id: progressId,
          role: 'system',
          content: '系统正在处理医学影像任务',
          createdAt: '处理中',
          progress: PROGRESS_TEMPLATE.map((stage) => ({ ...stage })),
        })
      }
      next.push({
        id: aiId,
        role: 'ai',
        content: '',
        createdAt: '生成中',
      })
      return next
    })

    try {
      for await (const event of streamChatEvents(content, authToken, activeConversationId)) {
        if (event.type === 'init') {
          setActiveConversationId(event.conversation_id)
        }

        if (event.type === 'title') {
          setConversationList((current) =>
            current.map((conversation) =>
              conversation.id === event.conversation_id ? { ...conversation, title: event.title } : conversation,
            ),
          )
        }

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

        if (event.type === 'findings') {
          const findings = normalizeFindings(event.data)
          setMessages((current) =>
            attachFindings(current, aiId, {
              findings,
              frameBaseUrl: event.frame_base_url,
              totalFrames: event.total_frames,
              modelSummary: event.data.report?.summary,
            }),
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

        if (event.type === 'done') {
          refreshConversationList()
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
            请输入内测邀请码。当前前端会通过 <code>/api/verify-invite</code> 获取会话令牌。
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

        <button
          className="new-chat-button"
          type="button"
          onClick={handleNewConversation}
        >
          + 新对话
        </button>

        <nav className="history-list">
          {groupedConversations.map((group) => (
            <section className="history-group" key={group.label}>
              <h2>{group.label}</h2>
              {group.items.map((conversation) => (
                <div
                  className={conversation.id === activeConversationId ? 'history-item active' : 'history-item'}
                  key={conversation.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSelectConversation(conversation.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') handleSelectConversation(conversation.id)
                  }}
                  onDoubleClick={() => {
                    setEditingTitleId(conversation.id)
                    setEditingTitle(conversation.title)
                  }}
                >
                  {editingTitleId === conversation.id ? (
                    <input
                      value={editingTitle}
                      autoFocus
                      onChange={(event) => setEditingTitle(event.target.value)}
                      onClick={(event) => event.stopPropagation()}
                      onBlur={() => submitTitle(conversation.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') submitTitle(conversation.id)
                        if (event.key === 'Escape') setEditingTitleId(null)
                      }}
                    />
                  ) : (
                    <span>{conversation.title}</span>
                  )}
                  <small>{formatConversationMeta(conversation)}</small>
                  {conversation.last_message_preview && <em>{conversation.last_message_preview}</em>}
                  <button
                    className="delete-chat-button"
                    type="button"
                    aria-label="删除对话"
                    onClick={(event) => {
                      event.stopPropagation()
                      handleDeleteConversation(conversation.id)
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </section>
          ))}
          {!conversationList.length && <p className="empty-history">暂无历史对话</p>}
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
              localStorage.removeItem(TOKEN_STORAGE_KEY)
              setAuthToken('')
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
              <span>检测到医学影像链接，是否开始分析？</span>
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
    <article className={`message ${message.role} ${message.findings ? 'wide' : ''}`}>
      <div className="avatar">{message.role === 'user' ? '我' : message.role === 'ai' ? 'AI' : '进'}</div>
      <div className="bubble">
        {message.progress ? (
          <ProgressPanel stages={message.progress} />
        ) : (
          <>
            {(message.content || !message.findings) && (
              <div
                className="markdown"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content || '正在生成...') }}
              />
            )}
            {message.findings && message.frameBaseUrl && (
              <FindingsPanel
                findings={message.findings}
                modelSummary={message.modelSummary}
                frameBaseUrl={message.frameBaseUrl}
                totalFrames={message.totalFrames}
              />
            )}
          </>
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

function FindingsPanel({
  findings,
  modelSummary,
  frameBaseUrl,
  totalFrames,
}: {
  findings: Finding[]
  modelSummary?: string
  frameBaseUrl: string
  totalFrames?: number
}) {
  const firstFrame = findings.find((item) => typeof item.sliceIndex === 'number')?.sliceIndex ?? 0
  const [selectedId, setSelectedId] = useState(findings[0]?.findingUid ?? '')
  const [frameIndex, setFrameIndex] = useState(firstFrame)
  const [imageSize, setImageSize] = useState({ width: 1044, height: 1044 })
  const [imageError, setImageError] = useState(false)

  const selected = findings.find((item) => item.findingUid === selectedId) ?? findings[0]
  const activeBox =
    !imageError && selected?.boundingBox && selected.sliceIndex === frameIndex
      ? selected.boundingBox
      : undefined
  const maxFrame = Math.max((totalFrames ?? 1) - 1, 0)
  const frameUrl = `${frameBaseUrl}/frame_${String(clamp(frameIndex, 0, maxFrame)).padStart(4, '0')}.png`

  return (
    <section className="findings-panel">
      <div className="findings-head">
        <div>
          <strong>模型结构化发现</strong>
          {modelSummary && <span>{modelSummary}</span>}
        </div>
        <small>{findings.length} 个病灶</small>
      </div>

      <div className="findings-grid">
        <div className="frame-viewer">
          <div className="image-stage">
            <img
              src={frameUrl}
              alt={`frame ${frameIndex}`}
              onLoad={(event) => {
                setImageError(false)
                setImageSize({
                  width: event.currentTarget.naturalWidth || 1044,
                  height: event.currentTarget.naturalHeight || 1044,
                })
              }}
              onError={() => setImageError(true)}
            />
            {imageError && <div className="image-error">帧图像加载失败：{frameUrl}</div>}
            {activeBox && <BoundingBox box={activeBox} imageSize={imageSize} />}
          </div>
          <div className="frame-controls">
            <button type="button" onClick={() => setFrameIndex((value) => clamp(value - 1, 0, maxFrame))}>
              ‹
            </button>
            <span>
              frame {clamp(frameIndex, 0, maxFrame)}/{maxFrame}
            </span>
            <button type="button" onClick={() => setFrameIndex((value) => clamp(value + 1, 0, maxFrame))}>
              ›
            </button>
          </div>
        </div>

        <div className="finding-list">
          {findings.map((finding, index) => (
            <button
              className={finding.findingUid === selectedId ? 'finding-item active' : 'finding-item'}
              key={finding.findingUid}
              type="button"
              onClick={() => {
                setSelectedId(finding.findingUid)
                if (typeof finding.sliceIndex === 'number') setFrameIndex(finding.sliceIndex)
              }}
            >
              <span className={`category-dot ${finding.category}`} />
              <strong>{categoryLabel(finding.category)} #{index + 1}</strong>
              <span>{finding.location}</span>
              <small>{finding.description}</small>
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}

function BoundingBox({
  box,
  imageSize,
}: {
  box: { x: number; y: number }[]
  imageSize: { width: number; height: number }
}) {
  const [start, end] = box
  const left = (Math.min(start.x, end.x) / imageSize.width) * 100
  const top = (Math.min(start.y, end.y) / imageSize.height) * 100
  const width = (Math.abs(end.x - start.x) / imageSize.width) * 100
  const height = (Math.abs(end.y - start.y) / imageSize.height) * 100

  return (
    <span
      className="bbox"
      style={{
        left: `${left}%`,
        top: `${top}%`,
        width: `${width}%`,
        height: `${height}%`,
      }}
    />
  )
}

async function verifyInvite(code: string) {
  try {
    const response = await fetch('/api/verify-invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })

    if (!response.ok) return ''
    const data = (await response.json()) as { valid?: boolean; token?: string | null }
    if (data.valid && data.token) return data.token
  } catch {
    if (VALID_INVITES.includes(code)) return ''
  }

  return ''
}

async function fetchConversationList() {
  const response = await fetch('/api/conversations')
  if (!response.ok) throw new Error(`加载对话失败 (${response.status})`)
  return (await response.json()) as Conversation[]
}

async function createConversation() {
  const response = await fetch('/api/conversations', { method: 'POST' })
  if (!response.ok) throw new Error(`创建对话失败 (${response.status})`)
  return (await response.json()) as Conversation
}

async function fetchConversation(id: string) {
  const response = await fetch(`/api/conversations/${id}`)
  if (!response.ok) throw new Error(`加载对话失败 (${response.status})`)
  return (await response.json()) as StoredConversation
}

async function deleteConversation(id: string) {
  const response = await fetch(`/api/conversations/${id}`, { method: 'DELETE' })
  if (!response.ok) throw new Error(`删除对话失败 (${response.status})`)
}

async function updateConversationTitle(id: string, title: string) {
  const response = await fetch(`/api/conversations/${id}/title`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  })
  if (!response.ok) throw new Error(`更新标题失败 (${response.status})`)
}

async function* streamChatEvents(
  content: string,
  token: string,
  conversationId: string | null,
): AsyncGenerator<SseEvent> {
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: content, token, conversation_id: conversationId }),
    })

    if (!response.ok || !response.body) {
      let detail = ''
      try {
        detail = formatApiError(await response.json())
      } catch {
        detail = ''
      }
      throw new Error(detail || `API request failed (${response.status})`)
    }
    yield* parseSseStream(response.body)
  } catch (error) {
    yield {
      type: 'error',
      message: error instanceof Error ? error.message : 'API unavailable',
    }
  }
}

function mapStoredMessage(message: StoredMessage): ChatMessage {
  if (message.message_type === 'progress') {
    const stage = stringValue(message.metadata?.stage, 'report')
    const percent = numberValue(message.metadata?.percent) ?? 0
    return {
      id: message.id,
      role: 'system',
      content: message.content,
      createdAt: formatMessageTime(message.created_at),
      progress: progressSnapshot(stage, percent, message.content),
    }
  }

  if (message.message_type === 'report') {
    return {
      id: message.id,
      role: 'ai',
      content: `### 原始报告提取\n${message.content}`,
      createdAt: formatMessageTime(message.created_at),
    }
  }

  if (message.message_type === 'findings') {
    const data = (message.metadata?.data ?? {}) as ModelResult
    return {
      id: message.id,
      role: 'ai',
      content: '',
      createdAt: formatMessageTime(message.created_at),
      findings: normalizeFindings(data),
      modelSummary: data.report?.summary,
      frameBaseUrl: stringValue(message.metadata?.frame_base_url, ''),
      totalFrames: numberValue(message.metadata?.total_frames),
    }
  }

  return {
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt: formatMessageTime(message.created_at),
  }
}

function progressSnapshot(activeStage: string, percent: number, message: string): ProgressStage[] {
  const activeIndex = PROGRESS_TEMPLATE.findIndex((stage) => stage.key === activeStage)
  return PROGRESS_TEMPLATE.map((stage, index) => ({
    ...stage,
    percent: index < activeIndex ? 100 : stage.key === activeStage ? percent : 0,
    status: (
      index < activeIndex ? 'done' : stage.key === activeStage ? 'active' : 'pending'
    ) as ProgressStage['status'],
    message: stage.key === activeStage ? message : stage.message,
  }))
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
      const lines = chunk.split('\n')
      const eventLine = lines.find((line) => line.startsWith('event:'))
      const dataLines = lines.filter((line) => line.startsWith('data:'))
      if (!eventLine || dataLines.length === 0) continue

      const type = eventLine.replace('event:', '').trim()
      const data = JSON.parse(dataLines.map((line) => line.replace('data:', '').trim()).join('\n'))
      yield { type, ...data } as SseEvent
    }
  }
}

function normalizeFindings(modelResult: ModelResult): Finding[] {
  const lung = (modelResult.lung_lesions ?? []).map((item, index) => {
    const size = numberArray(item.size)
    return {
      findingUid: stringValue(item.findingUid, `lung-${index}`),
      type: stringValue(item.type, '肺结节'),
      location: stringValue(item.location, '未知位置'),
      dangerStr: stringValue(item.dangerStr, ''),
      sliceIndex: numberValue(item.sliceIndex),
      size,
      hu: numberValue(item.hu),
      boundingBox: bboxValue(item.boundingBox),
      category: 'lung' as const,
      probability: probabilityValue(item),
      description: `${stringValue(item.type, '结节')} ${formatSize(size)} ${stringValue(item.dangerStr, '')} Prob: ${formatProbability(probabilityValue(item))}`,
    }
  })

  const rib = (modelResult.rib_lesions ?? []).map((item, index) => ({
    findingUid: stringValue(item.FindingUID, `rib-${index}`),
    type: '肋骨骨折',
    location: `第 ${stringValue(item.RibLabel, '?')} 肋`,
    category: 'rib' as const,
    probability: probabilityValue(item),
    description: `3D 框宽 ${stringValue(item.Width, '?')}mm Prob: ${formatProbability(probabilityValue(item))}`,
  }))

  const bone = (modelResult.bone_metastasis_lesions ?? []).map((item, index) => ({
    findingUid: stringValue(item.FindingUID, `bone-${index}`),
    type: '骨转移可疑灶',
    location: `骨位置 ${stringValue(item.LocationFirst, '?')}-${stringValue(item.LocationSecond, '?')}`,
    category: 'bone' as const,
    probability: probabilityValue(item),
    description: `病变类型 ${stringValue(item.LesionType, '?')} Prob: ${formatProbability(probabilityValue(item))}`,
  }))

  const lymph = (modelResult.lymphnode_lesions ?? []).map((item, index) => ({
    findingUid: stringValue(item.FindingUID, `lymph-${index}`),
    type: '淋巴结',
    location: `Slice ${stringValue(item.Slice, '?')}`,
    sliceIndex: numberValue(item.Slice),
    size: [numberValue(item.Long_axis_mm), numberValue(item.Short_axis_mm)].filter(
      (value): value is number => typeof value === 'number',
    ),
    category: 'lymph' as const,
    probability: probabilityValue(item),
    description: `${stringValue(item.Long_axis_mm, '?')}x${stringValue(item.Short_axis_mm, '?')}mm Prob: ${formatProbability(probabilityValue(item))}`,
  }))

  return [...lung, ...rib, ...bone, ...lymph]
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

function attachFindings(
  messages: ChatMessage[],
  id: string,
  data: Pick<ChatMessage, 'findings' | 'frameBaseUrl' | 'totalFrames' | 'modelSummary'>,
) {
  return messages.map((message) => (message.id === id ? { ...message, ...data } : message))
}

function extractFirstUrl(value: string) {
  return value.match(/https?:\/\/[^\s]+/i)?.[0] ?? ''
}

function renderMarkdown(markdown: string) {
  return marked.parse(markdown) as string
}

function formatApiError(payload: unknown) {
  if (!payload || typeof payload !== 'object') return ''
  const detail = (payload as { detail?: unknown }).detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (!item || typeof item !== 'object') return String(item)
        const entry = item as { loc?: unknown[]; msg?: string }
        const loc = Array.isArray(entry.loc) ? entry.loc.join('.') : ''
        return loc && entry.msg ? `${loc}: ${entry.msg}` : entry.msg || JSON.stringify(item)
      })
      .join('; ')
  }
  return JSON.stringify(detail ?? payload)
}

function groupConversationsByDate(conversations: Conversation[]) {
  const groups = [
    { label: '今日', items: [] as Conversation[] },
    { label: '昨天', items: [] as Conversation[] },
    { label: '本周', items: [] as Conversation[] },
    { label: '更早', items: [] as Conversation[] },
  ]
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000
  const weekStart = todayStart - 6 * 24 * 60 * 60 * 1000

  conversations.forEach((conversation) => {
    const time = new Date(conversation.updated_at).getTime()
    if (time >= todayStart) groups[0].items.push(conversation)
    else if (time >= yesterdayStart) groups[1].items.push(conversation)
    else if (time >= weekStart) groups[2].items.push(conversation)
    else groups[3].items.push(conversation)
  })

  return groups.filter((group) => group.items.length)
}

function formatConversationMeta(conversation: Conversation) {
  const time = formatMessageTime(conversation.last_message_at || conversation.updated_at)
  const count = conversation.message_count ? `${conversation.message_count} 条消息` : '新对话'
  return `${time} · ${count}`
}

function formatMessageTime(value: string) {
  if (!value) return '刚刚'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '刚刚'
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  if (diff < 60 * 1000) return '刚刚'
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)}分钟前`
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }
  return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function categoryLabel(category: FindingCategory) {
  return {
    lung: '肺结节',
    rib: '肋骨骨折',
    bone: '骨转移',
    lymph: '淋巴结',
  }[category]
}

function numberValue(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function stringValue(value: unknown, fallback: string) {
  if (typeof value === 'string' && value) return value
  if (typeof value === 'number') return String(value)
  return fallback
}

function numberArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is number => typeof item === 'number') : undefined
}

function bboxValue(value: unknown) {
  if (!Array.isArray(value) || value.length !== 2) return undefined
  const points = value
    .map((point) => {
      if (!point || typeof point !== 'object') return undefined
      const x = numberValue((point as Record<string, unknown>).x)
      const y = numberValue((point as Record<string, unknown>).y)
      return typeof x === 'number' && typeof y === 'number' ? { x, y } : undefined
    })
    .filter((point): point is { x: number; y: number } => Boolean(point))
  return points.length === 2 ? points : undefined
}

function probabilityValue(item: Record<string, unknown>) {
  return numberValue(item.Probality) ?? numberValue(item.Probability)
}

function formatProbability(value?: number) {
  return typeof value === 'number' ? value.toFixed(2) : '--'
}

function formatSize(size?: number[]) {
  if (!size?.length) return ''
  return `${size.map((value) => value.toFixed(value >= 10 ? 0 : 1)).join('x')}mm`
}

export default App
