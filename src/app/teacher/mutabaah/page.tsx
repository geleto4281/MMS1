'use client'

import { LocalizedDashboardContent } from '@/components/LocalizedDashboardContent'
import { useEffect, useMemo, useState } from 'react'
import { BookOpen, CheckCircle2, Loader2, MessageCircle, Send, Trash2 } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { rtdb } from '@/lib/database'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { VoiceNoteRecorder } from '@/components/VoiceNoteRecorder'
import { QURAN_SURAHS } from '@/lib/mutabaah'
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
  const [studyAreas, setStudyAreas] = useState<MutabaahStudyArea[]>(['quran'])
  const [quranTracks, setQuranTracks] = useState<Array<'hifz' | 'nezer'>>([])
  const [hifzSurah, setHifzSurah] = useState('')
  const [hifzJuz, setHifzJuz] = useState('')
  const [hifzFromAyah, setHifzFromAyah] = useState('')
  const [hifzToAyah, setHifzToAyah] = useState('')
  const [nezerSurah, setNezerSurah] = useState('')
  const [nezerFromAyah, setNezerFromAyah] = useState('')
  const [nezerToAyah, setNezerToAyah] = useState('')
  const [qaidaName, setQaidaName] = useState('')
  const [qaidaFrom, setQaidaFrom] = useState('')
  const [qaidaTo, setQaidaTo] = useState('')
  const [kitabName, setKitabName] = useState('')
  const [kitabFrom, setKitabFrom] = useState('')
  const [kitabTo, setKitabTo] = useState('')
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
  const [deletingAudio, setDeletingAudio] = useState('')

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

  const toggleStudyArea = (area: MutabaahStudyArea) => {
    setStudyAreas((current) => current.includes(area)
      ? current.filter((value) => value !== area)
      : [...current, area])
  }

  const toggleQuranTrack = (track: 'hifz' | 'nezer') => {
    setQuranTracks((current) => current.includes(track)
      ? current.filter((value) => value !== track)
      : [...current, track])
  }

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
    if (!studyAreas.length) {
      setError('Select at least one study area: Quran, Qaida, or Kitab.')
      return
    }
    if (studyAreas.includes('quran') && !quranTracks.length) {
      setError('Select Hifz, Nezer, or both for the Quran lesson.')
      return
    }
    if (studyAreas.includes('quran') && quranTracks.includes('hifz') && (!hifzSurah || !hifzFromAyah.trim() || !hifzToAyah.trim())) {
      setError('For Hifz, select the memorized Surah and enter the From and To ayahs.')
      return
    }
    if (studyAreas.includes('quran') && quranTracks.includes('nezer') && (!nezerSurah || !nezerFromAyah.trim() || !nezerToAyah.trim())) {
      setError('For Nezer, select the Surah and enter the From and To ayahs.')
      return
    }
    if (studyAreas.includes('qaida') && (!qaidaName.trim() || !qaidaFrom.trim() || !qaidaTo.trim())) {
      setError('Complete the Qaida name and its From and To lesson numbers.')
      return
    }
    if (studyAreas.includes('kitab') && (!kitabName.trim() || !kitabFrom.trim() || !kitabTo.trim())) {
      setError('Complete the Kitab name and its From and To pages or lessons.')
      return
    }
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const currentClass = classes.find((item) => item.id === classId)
      const common = {
        classId,
        date,
        teacherId: user.uid,
        teacherName: user.name,
        homework: homework.trim() || undefined,
        evaluation,
        tags,
        remark: remark.trim() || undefined,
        createdAt: new Date().toISOString(),
      }
      const createLogsForStudent = (student: Student) => {
        const logs: Omit<MutabaahLog, 'id'>[] = []
        if (studyAreas.includes('quran')) {
          const hasHifz = quranTracks.includes('hifz')
          const hasNezer = quranTracks.includes('nezer')
          const hifzRange = `${hifzFromAyah.trim()}–${hifzToAyah.trim()}`
          const nezerRange = `${nezerFromAyah.trim()}–${nezerToAyah.trim()}`
          logs.push({
            ...common,
            studentId: student.id,
            studyArea: 'quran',
            studyName: hasHifz ? hifzSurah : nezerSurah,
            lessonType: hasHifz ? 'sabaq' : 'tilawah',
            quranTracks,
            hifzSurah: hasHifz ? hifzSurah : undefined,
            hifzJuz: hasHifz ? hifzJuz.trim() || undefined : undefined,
            hifzFromAyah: hasHifz ? hifzFromAyah.trim() : undefined,
            hifzToAyah: hasHifz ? hifzToAyah.trim() : undefined,
            nezerSurah: hasNezer ? nezerSurah : undefined,
            nezerFromAyah: hasNezer ? nezerFromAyah.trim() : undefined,
            nezerToAyah: hasNezer ? nezerToAyah.trim() : undefined,
            surah: hasHifz ? hifzSurah : nezerSurah,
            juz: hasHifz ? hifzJuz.trim() || undefined : undefined,
            rangeFrom: hasHifz && !hasNezer ? hifzFromAyah.trim() : hasNezer && !hasHifz ? nezerFromAyah.trim() : undefined,
            rangeTo: hasHifz && !hasNezer ? hifzToAyah.trim() : hasNezer && !hasHifz ? nezerToAyah.trim() : undefined,
            ayahRange: hasHifz && !hasNezer ? hifzRange : hasNezer && !hasHifz ? nezerRange : undefined,
          })
        }
        if (studyAreas.includes('qaida')) {
          const range = `${qaidaFrom.trim()}–${qaidaTo.trim()}`
          logs.push({
            ...common,
            studentId: student.id,
            studyArea: 'qaida',
            studyName: qaidaName.trim(),
            lessonType: 'qaida',
            rangeFrom: qaidaFrom.trim(),
            rangeTo: qaidaTo.trim(),
            pageOrLesson: range,
          })
        }
        if (studyAreas.includes('kitab')) {
          const range = `${kitabFrom.trim()}–${kitabTo.trim()}`
          logs.push({
            ...common,
            studentId: student.id,
            studyArea: 'kitab',
            studyName: kitabName.trim(),
            lessonType: 'kitab',
            rangeFrom: kitabFrom.trim(),
            rangeTo: kitabTo.trim(),
            pageOrLesson: range,
          })
        }
        if (logs.length && voiceNote) logs[0].voiceNote = voiceNote
        return logs
      }
      await Promise.all(targets.flatMap((student) => createLogsForStudent(student)
        .map((log) => rtdb.createMutabaahLog(student.id, log))))
      const rows = await Promise.all(classStudents.map((student) => rtdb.getMutabaahLogs(student.id)))
      setLogs(rows.flat().sort((a, b) => b.date.localeCompare(a.date)))
      setNotice(`Saved ${targets.length === 1 ? targets[0].name + "'s" : `${targets.length} students’`} daily mutaba’ah${currentClass ? ` for ${currentClass.name}` : ''}.`)
      setQuranTracks([])
      setHifzSurah('')
      setHifzJuz('')
      setHifzFromAyah('')
      setHifzToAyah('')
      setNezerSurah('')
      setNezerFromAyah('')
      setNezerToAyah('')
      setQaidaName('')
      setQaidaFrom('')
      setQaidaTo('')
      setKitabName('')
      setKitabFrom('')
      setKitabTo('')
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

  const deleteVoiceNote = async (log: MutabaahLog) => {
    if (!log.voiceNote || !window.confirm('Delete this voice note? Parents will no longer be able to play it.')) return
    setDeletingAudio(log.id)
    setError('')
    try {
      await rtdb.removeMutabaahVoiceNote(log.studentId, log.id)
      setLogs((current) => current.map((item) => item.id === log.id ? { ...item, voiceNote: undefined } : item))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete the voice note.')
    } finally {
      setDeletingAudio('')
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
              <fieldset className="space-y-2 md:col-span-2">
                <legend className="text-sm font-medium">What did the student study today? Select one or more.</legend>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    ['quran', 'Quran'],
                    ['qaida', 'Qaida'],
                    ['kitab', 'Kitab'],
                  ] as const).map(([area, label]) => (
                    <button key={area} type="button" aria-pressed={studyAreas.includes(area)} onClick={() => toggleStudyArea(area)} className={`min-h-11 rounded-xl border px-3 py-2 text-sm font-medium ${studyAreas.includes(area) ? 'border-cyan-300/60 bg-cyan-300/15 text-cyan-100' : 'border-white/10 bg-[#080f1b] text-slate-400 hover:border-white/25'}`}>{label}</button>
                  ))}
                </div>
              </fieldset>
              {studyAreas.includes('quran') && <fieldset className="grid gap-3 rounded-xl border border-white/10 p-3 md:col-span-2">
                <legend className="px-1 text-sm font-medium">Quran lesson</legend>
                <p className="text-xs text-slate-400">Choose Hifz, Nezer, or both. Hifz-only details are saved only when Hifz is selected.</p>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    ['hifz', 'Hifz · memorization'],
                    ['nezer', 'Nezer · reading'],
                  ] as const).map(([track, label]) => (
                    <button key={track} type="button" aria-pressed={quranTracks.includes(track)} onClick={() => toggleQuranTrack(track)} className={`min-h-11 rounded-xl border px-3 py-2 text-sm font-medium ${quranTracks.includes(track) ? 'border-violet-300/60 bg-violet-300/15 text-violet-100' : 'border-white/10 bg-[#080f1b] text-slate-400 hover:border-white/25'}`}>{label}</button>
                  ))}
                </div>
                {quranTracks.includes('hifz') && <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2"><Label htmlFor="mut-hifz-surah">Memorized Surah</Label><select id="mut-hifz-surah" value={hifzSurah} onChange={(event) => setHifzSurah(event.target.value)} required className="h-10 w-full rounded-lg border border-white/10 bg-[#080f1b] px-3 text-sm"><option value="">Select a Surah</option>{QURAN_SURAHS.map((name) => <option key={name} value={name}>{name}</option>)}</select></div>
                  <div className="space-y-2"><Label htmlFor="mut-hifz-juz">Memorized Juz (optional)</Label><select id="mut-hifz-juz" value={hifzJuz} onChange={(event) => setHifzJuz(event.target.value)} className="h-10 w-full rounded-lg border border-white/10 bg-[#080f1b] px-3 text-sm"><option value="">Not specified</option>{Array.from({ length: 30 }, (_, index) => <option key={index + 1} value={`Juz ${index + 1}`}>Juz {index + 1}</option>)}</select></div>
                  <div className="space-y-2"><Label htmlFor="mut-hifz-from">Hifz from Ayah</Label><Input id="mut-hifz-from" type="number" min="1" value={hifzFromAyah} onChange={(event) => setHifzFromAyah(event.target.value)} required placeholder="Starting ayah" /></div>
                  <div className="space-y-2"><Label htmlFor="mut-hifz-to">Hifz to Ayah</Label><Input id="mut-hifz-to" type="number" min="1" value={hifzToAyah} onChange={(event) => setHifzToAyah(event.target.value)} required placeholder="Ending ayah" /></div>
                </div>}
                {quranTracks.includes('nezer') && <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2"><Label htmlFor="mut-nezer-surah">Nezer Surah</Label><select id="mut-nezer-surah" value={nezerSurah} onChange={(event) => setNezerSurah(event.target.value)} required className="h-10 w-full rounded-lg border border-white/10 bg-[#080f1b] px-3 text-sm"><option value="">Select a Surah</option>{QURAN_SURAHS.map((name) => <option key={name} value={name}>{name}</option>)}</select></div>
                  <div className="space-y-2"><Label htmlFor="mut-nezer-from">Nezer from Ayah</Label><Input id="mut-nezer-from" type="number" min="1" value={nezerFromAyah} onChange={(event) => setNezerFromAyah(event.target.value)} required placeholder="Starting ayah" /></div>
                  <div className="space-y-2"><Label htmlFor="mut-nezer-to">Nezer to Ayah</Label><Input id="mut-nezer-to" type="number" min="1" value={nezerToAyah} onChange={(event) => setNezerToAyah(event.target.value)} required placeholder="Ending ayah" /></div>
                </div>}
              </fieldset>}
              {studyAreas.includes('qaida') && <fieldset className="grid gap-3 rounded-xl border border-white/10 p-3 sm:grid-cols-2 md:col-span-2">
                <legend className="px-1 text-sm font-medium">Qaida</legend>
                <div className="space-y-2"><Label htmlFor="mut-qaida-name">Qaida / level</Label><Input id="mut-qaida-name" value={qaidaName} onChange={(event) => setQaidaName(event.target.value)} placeholder="e.g. Qaida Noorania" required /></div>
                <div className="space-y-2"><Label htmlFor="mut-qaida-from">From lesson / page</Label><Input id="mut-qaida-from" value={qaidaFrom} onChange={(event) => setQaidaFrom(event.target.value)} required /></div>
                <div className="space-y-2"><Label htmlFor="mut-qaida-to">To lesson / page</Label><Input id="mut-qaida-to" value={qaidaTo} onChange={(event) => setQaidaTo(event.target.value)} required /></div>
              </fieldset>}
              {studyAreas.includes('kitab') && <fieldset className="grid gap-3 rounded-xl border border-white/10 p-3 sm:grid-cols-2 md:col-span-2">
                <legend className="px-1 text-sm font-medium">Kitab</legend>
                <div className="space-y-2"><Label htmlFor="mut-kitab-name">Kitab name</Label><Input id="mut-kitab-name" value={kitabName} onChange={(event) => setKitabName(event.target.value)} placeholder="e.g. Kitab al-Adab" required /></div>
                <div className="space-y-2"><Label htmlFor="mut-kitab-from">From page / lesson</Label><Input id="mut-kitab-from" value={kitabFrom} onChange={(event) => setKitabFrom(event.target.value)} required /></div>
                <div className="space-y-2"><Label htmlFor="mut-kitab-to">To page / lesson</Label><Input id="mut-kitab-to" value={kitabTo} onChange={(event) => setKitabTo(event.target.value)} required /></div>
              </fieldset>}
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
                <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-semibold text-white">{student?.name || 'Student'} · {log.date}</h3><p className="mt-1 text-sm text-slate-400">{log.studyArea || log.lessonType} · {log.studyName || log.surah || ''}{log.rangeFrom && log.rangeTo ? ` · ${log.rangeFrom}–${log.rangeTo}` : log.ayahRange ? ` · Ayah ${log.ayahRange}` : log.pageOrLesson ? ` · ${log.pageOrLesson}` : ''} {log.juz ? `· ${log.juz}` : ''}</p>{log.hifzSurah && <p className="mt-1 text-sm text-violet-200">Hifz: {log.hifzSurah}{log.hifzJuz ? ` · ${log.hifzJuz}` : ''}{log.hifzFromAyah && log.hifzToAyah ? ` · Ayah ${log.hifzFromAyah}–${log.hifzToAyah}` : ''}</p>}{log.nezerSurah && <p className="mt-1 text-sm text-cyan-200">Nezer: {log.nezerSurah}{log.nezerFromAyah && log.nezerToAyah ? ` · Ayah ${log.nezerFromAyah}–${log.nezerToAyah}` : ''}</p>}</div><span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ${log.acknowledgement ? 'bg-emerald-400/10 text-emerald-200' : 'bg-amber-300/10 text-amber-200'}`}>{log.acknowledgement ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}{log.acknowledgement ? `Seen by ${log.acknowledgement.parentName}` : 'Awaiting parent sign-off'}</span></div>
                <p className="mt-2 text-sm text-slate-300">Evaluation: <span className="text-cyan-100">{EVALUATION_LABELS[log.evaluation]}</span></p>
                {(log.tags || []).length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{(log.tags || []).map((tag) => <span key={tag} className="rounded-full bg-cyan-300/10 px-2 py-1 text-xs text-cyan-100">{tag}</span>)}</div>}
                {log.homework && <p className="mt-2 text-sm text-slate-300">Homework: {log.homework}</p>}
                {log.remark && <p className="mt-2 text-sm text-slate-300">{log.remark}</p>}
                {log.voiceNote && <div className="mt-3 flex flex-wrap items-center gap-2"><audio controls src={log.voiceNote} className="h-9 max-w-full" /><Button type="button" size="sm" variant="outline" disabled={deletingAudio === log.id} onClick={() => void deleteVoiceNote(log)}><Trash2 className="mr-2 h-4 w-4" />{deletingAudio === log.id ? 'Deleting…' : 'Delete audio'}</Button></div>}
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
