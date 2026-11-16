import { ArrowRight, Leaf, MessageCircle, Sparkles } from 'lucide-react'
import './post-focus-choice.css'

interface PostFocusChoiceProps {
  taskTitle: string
  storageError: boolean
  onChoose: (action: 'reflection' | 'check-in') => void
}

export default function PostFocusChoice({ taskTitle, storageError, onChoose }: PostFocusChoiceProps) {
  return <main className="checkin-screen page-container post-focus-choice">
    {storageError && <p className="storage-error" role="alert">Your choice could not be saved. Please try again.</p>}
    <div className="focus-top"><div className="brand-mark"><Leaf size={18} strokeWidth={2.3} /></div><span>LifeOS / Focus complete</span></div>
    <section className="post-focus-choice__card" aria-labelledby="post-focus-choice-title">
      <div className="section-icon"><Sparkles size={20} aria-hidden="true" /></div>
      <p className="eyebrow">YOUR FIRST FOCUS SESSION</p>
      <h1 id="post-focus-choice-title">What comes next?</h1>
      <p className="muted">Your session with “{taskTitle}” is complete. Choose how you would like to close future sessions. You can change this in Settings.</p>
      <div className="post-focus-choice__options">
        <button type="button" className="post-focus-choice__option recommended" onClick={() => onChoose('reflection')}>
          <span className="post-focus-choice__icon"><MessageCircle size={22} aria-hidden="true" /></span>
          <span className="post-focus-choice__copy">
            <strong>Рефлексия <span className="post-focus-choice__badge">Рекомендуем</span></strong>
            <span>Ответьте на несколько вопросов о том, что помогло сосредоточиться.</span>
          </span>
          <ArrowRight size={20} aria-hidden="true" />
        </button>
        <button type="button" className="post-focus-choice__option" onClick={() => onChoose('check-in')}>
          <span className="post-focus-choice__icon"><Sparkles size={22} aria-hidden="true" /></span>
          <span className="post-focus-choice__copy">
            <strong>Автоматический чек-ин</strong>
            <span>После сессии открывайте короткую оценку интереса и прогресса.</span>
          </span>
          <ArrowRight size={20} aria-hidden="true" />
        </button>
      </div>
    </section>
  </main>
}
