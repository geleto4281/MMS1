'use client'

import { useRef, useState } from 'react'
import { Mic, Square, X } from 'lucide-react'

export function VoiceNoteRecorder({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const recorder = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState('')

  const start = async () => {
    setError('')
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Voice recording is not supported by this browser.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      recorder.current = mediaRecorder
      chunks.current = []
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size) chunks.current.push(event.data)
      }
      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop())
        const blob = new Blob(chunks.current, { type: mediaRecorder.mimeType || 'audio/webm' })
        if (blob.size > 900_000) {
          setError('The recording is too large. Please record a shorter voice note.')
          return
        }
        const reader = new FileReader()
        reader.onload = () => {
          if (typeof reader.result === 'string') onChange(reader.result)
        }
        reader.onerror = () => setError('Could not prepare the voice note. Please try again.')
        reader.readAsDataURL(blob)
      }
      mediaRecorder.start()
      setRecording(true)
      window.setTimeout(() => {
        if (mediaRecorder.state === 'recording') mediaRecorder.stop()
        setRecording(false)
      }, 45_000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Microphone access was denied.')
    }
  }

  const stop = () => {
    if (recorder.current?.state === 'recording') recorder.current.stop()
    setRecording(false)
  }

  return (
    <div className="space-y-2">
      {recording ? (
        <button type="button" onClick={stop} className="inline-flex items-center gap-2 rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-200">
          <Square className="h-4 w-4" /> Stop recording
        </button>
      ) : (
        <button type="button" onClick={start} className="inline-flex items-center gap-2 rounded-lg border border-cyan-300/25 bg-cyan-300/10 px-3 py-2 text-sm text-cyan-200">
          <Mic className="h-4 w-4" /> Record voice note
        </button>
      )}
      {value && (
        <div className="flex flex-wrap items-center gap-2">
          <audio controls src={value} className="h-9 max-w-full" />
          <button type="button" aria-label="Remove voice note" onClick={() => onChange('')} className="rounded-md p-1 text-slate-400 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
    </div>
  )
}
