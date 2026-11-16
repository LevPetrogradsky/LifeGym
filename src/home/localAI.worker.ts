import { pipeline } from '@huggingface/transformers'

const modelId = 'onnx-community/SmolLM2-135M-Instruct-ONNX-MHA'

function loadModel() {
  return pipeline('text-generation', modelId, {
    device: 'wasm',
    dtype: 'q4',
    progress_callback: info => {
      if (info.status === 'progress') {
        self.postMessage({ type: 'progress', progress: Math.round(info.progress) })
      }
    },
  })
}

let modelPromise: ReturnType<typeof loadModel> | null = null

type Request = { type: 'load' } | { type: 'ask'; question: string }

self.onmessage = async ({ data }: MessageEvent<Request>) => {
  try {
    if (data.type === 'load') {
      modelPromise ??= loadModel()
      await modelPromise
      self.postMessage({ type: 'ready' })
      return
    }

    if (!modelPromise) throw new Error('Model is not ready')
    const model = await modelPromise
    const result = await model([
      { role: 'system', content: 'You are an experimental local assistant in LifeOS, a personal productivity app. LifeOS has Today and Someday tasks, an open-ended Focus timer, a Journal for notes, and Reflection after focus sessions. A focus session tracks time spent on a task; it has no fixed duration and is not a meeting with a client. Answer briefly and honestly. You cannot see the user’s tasks, journal entries, or other private app data. If you do not know how a feature works, say so.' },
      { role: 'user', content: data.question },
    ], { max_new_tokens: 120, do_sample: false })
    const generated = result[0]?.generated_text
    const answer = typeof generated === 'string'
      ? generated
      : Array.isArray(generated) ? generated.at(-1)?.content : ''
    if (typeof answer !== 'string' || !answer.trim() || answer.trim() === data.question.trim()) {
      throw new Error('No generated answer')
    }
    self.postMessage({ type: 'answer', answer: answer.trim() })
  } catch {
    if (data.type === 'load') {
      modelPromise = null
      self.postMessage({ type: 'error' })
    } else {
      self.postMessage({ type: 'generation-error' })
    }
  }
}
