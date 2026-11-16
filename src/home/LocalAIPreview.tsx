import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowRight, Sparkles } from 'lucide-react'

type ModelState = 'preview' | 'loading' | 'ready' | 'generating' | 'failed'
type WorkerMessage = { type: 'progress'; progress: number } | { type: 'ready' } |
  { type: 'answer'; answer: string } | { type: 'error' } | { type: 'generation-error' }

export default function LocalAIPreview({ onBack }: { onBack: () => void }) {
  const worker = useRef<Worker | null>(null)
  const [state, setState] = useState<ModelState>('preview')
  const [progress, setProgress] = useState<number | null>(null)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => () => worker.current?.terminate(), [])

  const fail = () => {
    worker.current?.terminate()
    worker.current = null
    setState('failed')
  }

  const start = () => {
    worker.current?.terminate()
    setProgress(null)
    setState('loading')
    try {
      const next = new Worker(new URL('./localAI.worker.ts', import.meta.url), { type: 'module' })
      worker.current = next
      next.onmessage = ({ data }: MessageEvent<WorkerMessage>) => {
        if (data.type === 'progress') setProgress(data.progress)
        if (data.type === 'ready') setState('ready')
        if (data.type === 'answer') { setAnswer(data.answer); setState('ready') }
        if (data.type === 'generation-error') {
          setNotice('Модель не смогла ответить на этот вопрос. Попробуйте другой или вернитесь к обычным подсказкам.')
          setState('ready')
        }
        if (data.type === 'error') fail()
      }
      next.onerror = fail
      next.onmessageerror = fail
      next.postMessage({ type: 'load' })
    } catch { fail() }
  }

  const ask = (event: FormEvent) => {
    event.preventDefault()
    const trimmed = question.trim()
    if (!trimmed || state !== 'ready' || !worker.current) return
    setAnswer('')
    setNotice('')
    setState('generating')
    worker.current.postMessage({ type: 'ask', question: trimmed })
  }

  return <div className="life-main-ai" aria-label="Experimental local AI">
    <div className="life-main-ai-heading">
      <span className="life-main-guide-icon"><Sparkles size={19} aria-hidden="true" /></span>
      <div><h2>Локальный ИИ</h2><p>Экспериментальный предпросмотр</p></div>
    </div>
    <p className="life-main-ai-explainer">Модель загружается с Hugging Face только после запуска и отвечает на устройстве. Журнал и другие данные LifeOS ей недоступны.</p>
    {state === 'preview' && <button type="button" className="life-main-ai-start" onClick={start}>Запустить локальную модель</button>}
    {state === 'loading' && <p className="life-main-ai-status" role="status">Загрузка модели{progress === null ? '…' : ` · ${progress}%`}. Это может занять несколько минут.</p>}
    {state === 'failed' && <div className="life-main-ai-error" role="alert">
      <p>Генерация сейчас недоступна на этом устройстве. Обычные подсказки продолжают работать.</p>
      <button type="button" onClick={start}>Повторить попытку</button>
    </div>}
    {(state === 'ready' || state === 'generating') && <>
      <form className="life-main-guide-form" onSubmit={ask}>
        <label className="journal-sr-only" htmlFor="life-main-ai-question">Вопрос локальному ИИ</label>
        <input id="life-main-ai-question" value={question} maxLength={300} placeholder="Спросите локальный ИИ…"
          onChange={event => setQuestion(event.target.value)} />
        <button type="submit" aria-label="Отправить вопрос ИИ" disabled={!question.trim() || state === 'generating'}><ArrowRight size={18} aria-hidden="true" /></button>
      </form>
      {state === 'generating' && <p className="life-main-ai-status" role="status">Формирую ответ на этом устройстве…</p>}
      {notice && <p className="life-main-ai-status" role="status">{notice}</p>}
      {answer && <p className="life-main-ai-answer" aria-live="polite">{answer}</p>}
      <p className="life-main-ai-caution">Ответы экспериментальные и могут быть неточными. Точные инструкции по LifeOS есть в обычных подсказках.</p>
    </>}
    <button type="button" className="life-main-ai-back" onClick={onBack}>Вернуться к подсказкам</button>
  </div>
}
