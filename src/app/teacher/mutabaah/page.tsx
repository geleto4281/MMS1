'use client'

import { LocalizedDashboardContent } from '@/components/LocalizedDashboardContent'
import { useEffect, useMemo, useState } from 'react'
import { BookOpen, CheckCircle2, Loader2, MessageCircle, Mic, Send } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { rtdb } from '@/lib/database'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { VoiceNoteRecorder } from '@/components/VoiceNoteRecorder'
import type { Class, LeaveRequest, MutabaahEvaluation, MutabaahLog, MutabaahStudyArea, Student } from '@/types'

const TAGS = ['Good Adab', 'Prayed in Jama’ah', 'Needs home revision', 'Forgot Mus’haf/Book', 'Late to Halqah']
const EVALUATIONS: { value: MutabaahEvaluation; label: string }[] = [
  { value: 'excellent', label: 'Excellent' },
  { value: 'very_good', label: 'Very good' },
  { value: 'good', label: 'Good' },
  { value: 'practice', label: 'Study again' },
]

const EVALUATION_LABELS: Record<MutabaahEvaluation, string> = {
  excellent: 'Excellent',
  very_good: 'Very good',
  good: 'Good',
  practice: 'Study again',
}

export default function MutabaahTeacherPage() {
  const { user } = useAuth()
  const [classes, setClasses] = useState<Class[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [logs, setLogs] = useState<MutabaahLog[]>([])
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([])
  const [classId, setClassId] = useState('')
  const [studentId, setStudentId] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [studyArea, setStudyArea] = useState<MutabaahStudyArea>('quran')
  const [quranLessonType, setQuranLessonType] = useState<'sabaq' | 'tilawah'>('sabaq')
  const [studyName, setStudyName] = useState('')
  const [rangeFrom, setRangeFrom] = useState('')
  const [rangeTo, setRangeTo] = useState('')
  const [juz, setJuz] = useState('')
  const [sabqi, setSabqi] = useState('')
  const [manzil, setManzil] = useState('')
  const [homework, setHomework] = useState('')
  const [evaluation, setEvaluation] = useState<MutabaahEvaluation>('good')
  const [tags, setTags] = useState<string[]>([])
  const [remark, setRemark] = useState('')
  const [voiceNote, setVoiceNote] = useState('')
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user) return
    let active = true
    const load = async () => {
      try {
        const allClasses = await rtdb.getAllClasses()
        const ownedClasses = allClasses.filter((item) => item.teacherId === user.uid && item.isActive !== false)
        const classStudents = (await Promise.all(ownedClasses.map((item) => rtdb.getStudentsByClass(item.id))))
          .flat().filter((student) => student.isActive !== false)
        const requests = await rtdb.getLeaveRequests()
        if (!active) return
        setClasses(ownedClasses)
        setStudents(classStudents)
        setClassId(ownedClasses[0]?.id || '')
        setStudentId(classStudents[0]?.id || '')
        setLeaveRequests(requests.filter((request) => ownedClasses.some((item) => item.id === request.classId)))
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Could not load your class communication records.')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [user])

  const classStudents = useMemo(() => students.filter((student) => student.classId === classId), [students, classId])

  useEffect(() => {
    if (!classId || !classStudents.length) {
      setLogs([])
      return
    }
    let active = true
    Promise.all(classStudents.map((student) => rtdb.getMutabaahLogs(student.id)))
      .then((rows) => { if (active) setLogs(rows.flat().sort((a, b) => b.date.localeCompare(a.date))) })
      .catch((e) => { if (active) setError(e instanceof Error ? e.message : 'Could not load lesson logs.') })
    return () => { active = false }
  }, [classId, classStudents])

  const toggleTag = (tag: string) => setTags((current) => current.includes(tag) ? current.filter((value) => value !== tag) : [...current, tag])

  const saveLog = async (event: React.FormEvent) => {
    event.preventDefault()
    const targets = studentId === 'all' ? classStudents : classStudents.filter((student) => student.id === studentId)
    if (!targets.length || !user) {
      setError('Choose a student or class before saving.')
      return
    }
    if (studentId === 'all' && voiceNote) {
      setError('Voice notes can only be sent to one student at a time.')
      return
    }
    if (!studyName.trim() || !rangeFrom.trim() || !rangeTo.trim()) {
      setError('Enter the surah, Qaida, or Kitab name and both the From and To sections.')
      return
    }
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const currentClass = classes.find((item) => item.id === classId)
      const lessonType: MutabaahLog['lessonType'] = studyArea === 'quran'
        ? quranLessonType
        : studyArea === 'qaida'
          ? 'qaida'
          : 'kitab'
      const range = `${rangeFrom.trim()}–${rangeTo.trim()}`
      const data = {
        classId,
        date,
        teacherId: user.uid,
        teacherName: user.name,
        studyArea,
        studyName: studyName.trim(),
        rangeFrom: rangeFrom.trim(),
        rangeTo: rangeTo.trim(),
        lessonType,
        surah: studyArea === 'quran' ? studyName.trim() : undefined,
        juz: juz.trim() || undefined,
        ayahRange: studyArea === 'quran' ? range : undefined,
        pageOrLesson: studyArea !== 'quran' ? range : undefined,
        sabqi: sabqi.trim() || undefined,
        manzil: manzil.trim() || undefined,
        homework: homework.trim() || undefined,
        evaluation,
        tags,
        remark: remark.trim() || undefined,
        voiceNote: voiceNote || undefined,
        createdAt: new Date().toISOString(),
      }
      await Promise.all(targets.map((student) => rtdb.createMutabaahLog(student.id, { ...data, studentId: student.id })))
      const rows = await Promise.all(classStudents.map((student) => rtdb.getMutabaahLogs(student.id)))
      setLogs(rows.flat().sort((a, b) => b.date.localeCompare(a.date)))
      setNotice(`Saved ${targets.length === 1 ? targets[0].name + "'s" : `${targets.length} students’`} daily mutaba’ah${currentClass ? ` for ${currentClass.name}` : ''}.`)
      setStudyName('')
      setRangeFrom('')
      setRangeTo('')
      setJuz('')
      setSabqi('')
      setManzil('')
      setHomework('')
      setRemark('')
      setVoiceNote('')
      setTags([])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the daily log.')
    } finally {
      setSaving(false)
    }
  }

  const sendReply = async (log: MutabaahLog) => {
    const message = (replyDrafts[log.id] || '').trim()
    if (!message || !user) return
    try {
      await rtdb.addMutabaahReply(log.studentId, log.id, {
        authorId: user.uid,
        authorName: user.name,
        authorRole: 'teacher',
        message,
        createdAt: new Date().toISOString(),
      })
      setReplyDrafts((drafts) => ({ ...drafts, [log.id]: '' }))
      const rows = await Promise.all(classStudents.map((student) => rtdb.getMutabaahLogs(student.id)))
      setLogs(rows.flat().sort((a, b) => b.date.localeCompare(a.date)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send your reply.')
    }
  }

  const reviewLeave = async (request: LeaveRequest) => {
    try {
      await rtdb.updateLeaveRequest(request.id, { status: 'reviewed' })
      setLeaveRequests((current) => current.map((item) => item.id === request.id ? { ...item, status: 'reviewed' } : item))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update leave request.')
    }
  }

  if (loading) return <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-cyan-300" /></div>

  return (
    <LocalizedDashboardContent>
    <div className="mms-dashboard space-y-6">
      <header><h1 className="text-3xl font-bold tracking-tight text-white">Daily Mutaba’ah</h1><p className="mt-1 text-slate-400">Record each student’s Quran progress and keep the family in the loop.</p></header>
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      {notice && <Alert variant="success"><AlertDescription>{notice}</AlertDescription></Alert>}
      {!classes.length ? <Card><CardContent className="p-6 text-slate-400">No active classes are assigned to your account.</CardContent></Card> : <>
        <Card className="border-white/10 bg-[#0c1421]">
          <CardHeader><CardTitle className="flex items-center gap-2 text-white"><BookOpen className="h-5 w-5 text-cyan-300" />New daily lesson entry</CardTitle><CardDescription>Choose “Whole class” to send a shared homework/lesson note to every student in the Halqah.</CardDescription></CardHeader>
          <CardContent>
            <form onSubmit={saveLog} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="mut-class">Halqah / class</Label><select id="mut-class" value={classId} onChange={(e) => { setClassId(e.target.value); setStudentId('') }} className="h-10 w-full rounded-lg border border-white/10 bg-[#080f1b] px-3 text-sm">{classes.map((item) => <option key={item.id} value={item.id}>{item.name}{item.section ? ` · ${item.section}` : ''}</option>)}</select></div>
              <div className="space-y-2"><Label htmlFor="mut-student">Student</Label><select id="mut-student" value={studentId} onChange={(e) => setStudentId(e.target.value)} className="h-10 w-full rounded-lg border border-white/10 bg-[#080f1b] px-3 text-sm"><option value="all">Whole class</option>{classStudents.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}</select></div>
              <div className="space-y-2"><Label htmlFor="mut-date">Date</Label><Input id="mut-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></div>
              <div className="space-y-2"><Label htmlFor="mut-area">Study area</Label><select id="mut-area" value={studyArea} onChange={(e) => setStudyArea(e.target.value as MutabaahStudyArea)} className="h-10 w-full rounded-lg border border-white/10 bg-[#080f1b] px-3 text-sm"><option value="quran">Quran</option><option value="qaida">Qaida</option><option value="kitab">Kitab</option></select></div>
              {studyArea === 'quran' && <div className="space-y-2"><Label htmlFor="mut-quran-type">Quran lesson</Label><select id="mut-quran-type" value={quranLessonType} onChange={(e) => setQuranLessonType(e.target.value as typeof quranLessonType)} className="h-10 w-full rounded-lg border border-white/10 bg-[#080f1b] px-3 text-sm"><option value="sabaq">Sabaq · new memorization</option><option value="tilawah">Tilawah · recitation</option></select></div>}
              <div className="space-y-2"><Label htmlFor="mut-study-name">{studyArea === 'quran' ? 'Surah name' : studyArea === 'qaida' ? 'Qaida name / level' : 'Kitab name'}</Label><Input id="mut-study-name" value={studyName} onChange={(e) => setStudyName(e.target.value)} placeholder={studyArea === 'quran' ? 'e.g. Al-Mulk' : studyArea === 'qaida' ? 'e.g. Qaida Noorania' : 'e.g. Kitab al-Adab'} required /></div>
              <div className="space-y-2"><Label htmlFor="mut-from">{studyArea === 'quran' ? 'From ayah' : 'From page / lesson'}</Label><Input id="mut-from" value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} placeholder="Starting ayah, page, or lesson" required /></div>
              <div className="space-y-2"><Label htmlFor="mut-to">{studyArea === 'quran' ? 'To ayah' : 'To page / lesson'}</Label><Input id="mut-to" value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} placeholder="Ending ayah, page, or lesson" required /></div>
              {studyArea === 'quran' && <div className="space-y-2"><Label htmlFor="mut-juz">Current Juz (optional)</Label><Input id="mut-juz" value={juz} onChange={(e) => setJuz(e.target.value)} placeholder="e.g. Juz 29" /></div>}
              <div className="space-y-2"><Label htmlFor="mut-sabqi">Recent revision · Sabqi</Label><Input id="mut-sabqi" value={sabqi} onChange={(e) => setSabqi(e.target.value)} placeholder="Juz or surah range" /></div>
              <div className="space-y-2"><Label htmlFor="mut-manzil">Old revision · Manzil / Muraja’ah</Label><Input id="mut-manzil" value={manzil} onChange={(e) => setManzil(e.target.value)} placeholder="Juz or surah range" /></div>
              <div className="space-y-2"><Label htmlFor="mut-homework">Homework / class note (optional)</Label><Input id="mut-homework" value={homework} onChange={(e) => setHomework(e.target.value)} placeholder="Short homework or class note" /></div>
              <fieldset className="space-y-2 md:col-span-2"><legend className="text-sm font-medium">Performance rating</legend><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{EVALUATIONS.map((item) => <button key={item.value} type="button" aria-pressed={evaluation === item.value} onClick={() => setEvaluation(item.value)} className={`min-h-11 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${evaluation === item.value ? 'border-cyan-300/60 bg-cyan-300/15 text-cyan-100' : 'border-white/10 bg-[#080f1b] text-slate-400 hover:border-white/25'}`}>{item.label}</button>)}</div></fieldset>
              <div className="space-y-2 md:col-span-2"><Label htmlFor="mut-remark">Teacher remark</Label><Input id="mut-remark" value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="Short note for the parent" /></div>
              <fieldset className="space-y-2 md:col-span-2"><legend className="text-sm font-medium">Tarbiyah & adab tags</legend><div className="flex flex-wrap gap-2">{TAGS.map((tag) => <button key={tag} type="button" onClick={() => toggleTag(tag)} className={`rounded-full border px-3 py-1.5 text-xs ${tags.includes(tag) ? 'border-cyan-300/50 bg-cyan-300/10 text-cyan-100' : 'border-white/10 text-slate-400'}`}>{tag}</button>)}</div></fieldset>
              <div className="space-y-2 md:col-span-2"><Label>Voice note (optional · up to 45 seconds)</Label><VoiceNoteRecorder value={voiceNote} onChange={setVoiceNote} /></div>
              <div className="md:col-span-2"><Button type="submit" disabled={saving || !studentId} className="bg-cyan-400 text-slate-950 hover:bg-cyan-300">{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}{saving ? 'Saving…' : 'Save daily log'}</Button></div>
            </form>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-[#0c1421]">
          <CardHeader><CardTitle className="text-white">Parent follow-up</CardTitle><CardDescription>See acknowledgements and reply to a family under that day’s entry.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            {!logs.length ? <p className="py-6 text-center text-slate-400">No daily lesson entries recorded in this class yet.</p> : logs.slice(0, 40).map((log) => {
              const student = students.find((item) => item.id === log.studentId)
              const replies = Object.values(log.replies || {}).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
              return <article key={log.id} className="rounded-xl border border-white/10 bg-[#080f1b] p-4">
                <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-semibold text-white">{student?.name || 'Student'} · {log.date}</h3><p className="mt-1 text-sm text-slate-400">{log.studyArea || log.lessonType} · {log.studyName || log.surah || ''}{log.rangeFrom && log.rangeTo ? ` · ${log.rangeFrom}–${log.rangeTo}` : log.ayahRange ? ` · Ayah ${log.ayahRange}` : log.pageOrLesson ? ` · ${log.pageOrLesson}` : ''} {log.juz ? `· ${log.juz}` : ''}</p></div><span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ${log.acknowledgement ? 'bg-emerald-400/10 text-emerald-200' : 'bg-amber-300/10 text-amber-200'}`}>{log.acknowledgement ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}{log.acknowledgement ? `Seen by ${log.acknowledgement.parentName}` : 'Awaiting parent sign-off'}</span></div>
                <p className="mt-2 text-sm text-slate-300">Evaluation: <span className="text-cyan-100">{EVALUATION_LABELS[log.evaluation]}</span></p>
                {(log.tags || []).length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{(log.tags || []).map((tag) => <span key={tag} className="rounded-full bg-cyan-300/10 px-2 py-1 text-xs text-cyan-100">{tag}</span>)}</div>}
                {log.homework && <p className="mt-2 text-sm text-slate-300">Homework: {log.homework}</p>}
                {log.remark && <p className="mt-2 text-sm text-slate-300">{log.remark}</p>}
                {log.voiceNote && <audio controls src={log.voiceNote} className="mt-3 h-9 max-w-full" />}
                {replies.map((reply) => <p key={reply.id} className="mt-2 rounded-lg bg-white/5 p-2 text-sm text-slate-300"><span className="font-medium text-cyan-200">{reply.authorName}:</span> {reply.message}{reply.voiceNote && <audio controls src={reply.voiceNote} className="mt-2 h-8 max-w-full" />}</p>)}
                <div className="mt-3 flex gap-2"><Input value={replyDrafts[log.id] || ''} onChange={(e) => setReplyDrafts((drafts) => ({ ...drafts, [log.id]: e.target.value }))} placeholder="Reply to this parent…" /><Button type="button" variant="outline" aria-label="Send reply" disabled={!(replyDrafts[log.id] || '').trim()} onClick={() => void sendReply(log)}><MessageCircle className="h-4 w-4" /></Button></div>
              </article>
            })}
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-[#0c1421]">
          <CardHeader><CardTitle className="text-white">Leave requests</CardTitle><CardDescription>Absence notices submitted by families for your classes.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {!leaveRequests.length ? <p className="text-slate-400">No leave requests for your classes.</p> : leaveRequests.map((request) => <div key={request.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 p-3"><div><p className="font-medium text-white">{students.find((student) => student.id === request.studentId)?.name || 'Student'} · {request.date}</p><p className="text-sm text-slate-400">{request.reason}{request.note ? ` — ${request.note}` : ''} · {request.parentName}</p></div>{request.status === 'pending' ? <Button type="button" size="sm" variant="outline" onClick={() => void reviewLeave(request)}>Mark reviewed</Button> : <span className="text-xs text-emerald-200">Reviewed</span>}</div>)}
          </CardContent>
        </Card>
      </>}
    </div>
    </LocalizedDashboardContent>
  )
}
