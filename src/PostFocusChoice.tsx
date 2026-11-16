import { ArrowRight, Leaf, MessageCircle, Sparkles } from 'lucide-react'
import './post-focus-choice.css'

interface PostFocusChoiceProps {
  taskTitle: string
  storageError: boolean
  preferred?: 'reflection' | 'check-in'
  onChoose: (action: 'reflection' | 'check-in') => void
}

export default function PostFocusChoice({ taskTitle, storageError, preferred, onChoose }: PostFocusChoiceProps) {
  return <main className="checkin-screen page-container post-focus-choice">
    {storageError && <p className="storage-error" role="alert">Your choice could not be saved. Please try again.</p>}
    <div className="focus-top"><div className="brand-mark"><Leaf size={18} strokeWidth={2.3} /></div><span>LifeOS / Focus complete</span></div>
    <section className="post-focus-choice__card" aria-labelledby="post-focus-choice-title">
      <div className="section-icon"><Sparkles size={20} aria-hidden="true" /></div>
      <p className="eyebrow">FOCUS COMPLETE</p>
      <h1 id="post-focus-choice-title">Focus session saved</h1>
      <p className="muted">Your session with “{taskTitle}” is in Focus history. Choose how to close this session.</p>
      <div className="post-focus-choice__options">
        <button type="button" className="post-focus-choice__option" onClick={() => onChoose('reflection')}>
          <span className="post-focus-choice__icon"><MessageCircle size={22} aria-hidden="true" /></span>
          <span className="post-focus-choice__copy">
            <strong>Write a reflection {preferred === 'reflection' && <span className="post-focus-choice__badge">Preferred</span>}</strong>
            <span>Answer three questions about what helped.</span>
          </span>
          <ArrowRight size={20} aria-hidden="true" />
        </button>
        <button type="button" className="post-focus-choice__option" onClick={() => onChoose('check-in')}>
          <span className="post-focus-choice__icon"><Sparkles size={22} aria-hidden="true" /></span>
          <span className="post-focus-choice__copy">
            <strong>Quick check-in {preferred === 'check-in' && <span className="post-focus-choice__badge">Preferred</span>}</strong>
            <span>Rate interest, desire to continue, and progress.</span>
          </span>
          <ArrowRight size={20} aria-hidden="true" />
        </button>
      </div>
    </section>
  </main>
}
