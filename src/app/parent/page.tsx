'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, CheckCircle2, GraduationCap, Loader2, LogOut, MessageCircle, Wallet } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useLogout } from '@/hooks/useAuth'
import { rtdb } from '@/lib/database'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { VoiceNoteRecorder } from '@/components/VoiceNoteRecorder'
import type { Attendance, Class, FeeRecord, MutabaahLog, ParentExamResult, Student } from '@/types'

type ChildData = {
  attendance: Attendance[]
  fees: FeeRecord[]
  logs: MutabaahLog[]
  exams: ParentExamResult[]
  classInfo: Class | null
}

const EMPTY: ChildData = { attendance: [], fees: [], logs: [], exams: [], classInfo: null }

export default function ParentPortalPage() {
  const { user } = useAuth()
  const logoutUser = useLogout()
  const [children, setChildren] = useState<Student[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [childData, setChildData] = useState<ChildData>(EMPTY)
  const [loadingChildren, setLoadingChildren] = useState(true)
  const [loadingData, setLoadingData] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [leaveDate, setLeaveDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [leaveReason, setLeaveReason] = useState('Sickness')
  const [leaveNote, setLeaveNote] = useState('')
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({})
  const [replyVoices, setReplyVoices] = useState<Record<string, string>>({})
  const [savingLeave, setSavingLeave] = useState(false)
  const [sendingReply, setSendingReply] = useState<string | null>(null)

  const selectedChild = children.find((child) => child.id === selectedId) || null

  useEffect(() => {
    if (!user) return
    let active = true
    rtdb.getParentStudentIds(user.uid)
      .then(async (ids) => {
        const linked = (await Promise.all(ids.map((id) => rtdb.getStudent(id))))
          .filter((student): student is Student => Boolean(student && student.isActive !== false))
          .sort((a, b) => a.name.localeCompare(b.name))
        if (active) {
          setChildren(linked)
          setSelectedId(linked[0]?.id || '')
        }
      })
      .catch((e) => { if (active) setError(e instanceof Error ? e.message : 'Could not load linked children.') })
      .finally(() => { if (active) setLoadingChildren(false) })
    return () => { active = false }
  }, [user])

  useEffect(() => {
    if (!selectedChild) {
      setChildData(EMPTY)
      return
    }
    let active = true
    setLoadingData(true)
    Promise.all([
      rtdb.getAttendanceByStudent(selectedChild.id),
      rtdb.getFeeRecords(selectedChild.id),
      rtdb.getMutabaahLogs(selectedChild.id),
      rtdb.getParentExamResults(selectedChild.id),
      rtdb.getClass(selectedChild.classId),
    ])
      .then(([attendance, fees, logs, exams, classInfo]) => {
        if (!active) return
        setChildData({
          attendance: attendance.sort((a, b) => b.date.localeCompare(a.date)),
          fees,
          logs,
          exams,
          classInfo,
        })
      })
      .catch((e) => { if (active) setError(e instanceof Error ? e.message : 'Could not load this child’s school records.') })
      .finally(() => { if (active) setLoadingData(false) })
    return () => { active = false }
  }, [selectedChild])

  const refreshLogs = useCallback(async (studentId: string) => {
    const logs = await rtdb.getMutabaahLogs(studentId)
    setChildData((current) => ({ ...current, logs }))
  }, [])

  const today = new Date().toISOString().slice(0, 10)
  const todayAttendance = childData.attendance.find((record) => record.date === today)
  const todayLog = childData.logs.find((log) => log.date === today)
  const latestLog = childData.logs[0]
  const balances = useMemo(() => childData.fees.reduce((total, record) => ({
    billed: total.billed + (record.kind === 'charge' ? record.amount : 0),
    paid: total.paid + (record.kind === 'payment' ? record.amount : 0),
  }), { billed: 0, paid: 0 }), [childData.fees])
  const balanceDue = balances.billed - balances.paid

  const submitLeave = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!user || !selectedChild) return
    setSavingLeave(true)
    setError('')
    setNotice('')
    try {
      await rtdb.createLeaveRequest({
        studentId: selectedChild.id,
        classId: selectedChild.classId,
        parentId: user.uid,
        parentName: user.name,
        date: leaveDate,
        reason: leaveReason,
        note: leaveNote.trim() || undefined,
        status: 'pending',
        createdAt: new Date().toISOString(),
      })
      setNotice(`Leave notice sent for ${selectedChild.name}.`)
      setLeaveNote('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send this leave notice.')
    } finally {
      setSavingLeave(false)
    }
  }

  const signLog = async (log: MutabaahLog) => {
    if (!user) return
    try {
      await rtdb.acknowledgeMutabaah(log.studentId, log.id, user.uid, user.name)
      await refreshLogs(log.studentId)
      setNotice('Lesson marked as seen and revised at home.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not acknowledge this lesson.')
    }
  }

  const sendReply = async (log: MutabaahLog) => {
    if (!user) return
    const message = (replyDrafts[log.id] || '').trim()
    const voiceNote = replyVoices[log.id] || ''
    if (!message && !voiceNote) return
    setSendingReply(log.id)
    setError('')
    try {
      await rtdb.addMutabaahReply(log.studentId, log.id, {
        authorId: user.uid,
        authorName: user.name,
        authorRole: 'parent',
        message,
        voiceNote: voiceNote || undefined,
        createdAt: new Date().toISOString(),
      })
      setReplyDrafts((drafts) => ({ ...drafts, [log.id]: '' }))
      setReplyVoices((voices) => ({ ...voices, [log.id]: '' }))
      await refreshLogs(log.studentId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send your message.')
    } finally {
      setSendingReply(null)
    }
  }

  const handleLogout = async () => {
    const result = await logoutUser()
    if (result.success) window.location.href = '/login'
    else setError(result.error || 'Could not sign out.')
  }

  if (loadingChildren) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-cyan-300" /></div>

  return (
    <div className="mms-dashboard space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div><p className="text-sm font-semibold tracking-[0.2em] text-cyan-300">MMS1 FAMILY</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-white">Parent Portal</h1><p className="mt-1 text-slate-400">Welcome, {user?.name}. Keep up with your children’s learning.</p></div>
        <Button type="button" variant="outline" onClick={handleLogout} className="border-white/15 text-slate-300"><LogOut className="mr-2 h-4 w-4" />Sign out</Button>
      </header>
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      {notice && <Alert variant="success"><AlertDescription>{notice}</AlertDescription></Alert>}
      {!children.length ? (
        <Card className="border-amber-300/20 bg-[#0c1421]"><CardHeader><CardTitle className="text-white">No students linked yet</CardTitle><CardDescription>Please contact the Madrasah administrator. Your account email must match the parent email on each student’s record.</CardDescription></CardHeader></Card>
      ) : <>
        <div className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-white/10 bg-[#0c1421] p-4">
          <div className="space-y-2"><Label htmlFor="child-switcher">Viewing child</Label><select id="child-switcher" value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className="h-11 min-w-64 rounded-lg border border-white/10 bg-[#080f1b] px-3 text-sm text-slate-100">{children.map((child) => <option key={child.id} value={child.id}>{child.name}{child.className ? ` · ${child.className}` : ''}</option>)}</select></div>
          <div className="flex items-center gap-2 text-sm text-slate-400"><GraduationCap className="h-4 w-4 text-cyan-300" />{childData.classInfo?.name || selectedChild?.className || 'Class pending'}{childData.classInfo?.section ? ` · ${childData.classInfo.section}` : ''}</div>
        </div>
        {loadingData ? <div className="flex h-48 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-cyan-300" /></div> : <>
          <section className="grid gap-4 md:grid-cols-3">
            <Card className="border-cyan-300/20 bg-[#0c1421]"><CardHeader className="pb-2"><CardDescription>Today’s attendance</CardDescription><CardTitle className="text-2xl capitalize text-white">{todayAttendance?.status || 'Not recorded'}</CardTitle></CardHeader><CardContent><p className="text-xs text-slate-500">{todayAttendance?.note || todayAttendance?.excuseNote || (todayAttendance ? todayAttendance.date : `Attendance for ${today} has not been posted.`)}</p></CardContent></Card>
            <Card className="border-violet-300/20 bg-[#0c1421]"><CardHeader className="pb-2"><CardDescription>Today’s mutaba’ah</CardDescription><CardTitle className="text-lg text-white">{todayLog ? todayLog.evaluation === 'practice' ? 'Needs home revision' : todayLog.evaluation === 'excellent' ? 'Passed · Excellent' : 'Passed · Good' : 'No lesson update yet'}</CardTitle></CardHeader><CardContent><p className="text-xs text-slate-400">{todayLog ? `${todayLog.surah || todayLog.lessonType}${todayLog.ayahRange ? ` · Ayah ${todayLog.ayahRange}` : ''}` : `No daily log for ${today}.`}</p></CardContent></Card>
            <Card className="border-amber-300/20 bg-[#0c1421]"><CardHeader className="pb-2"><CardDescription>Fee balance</CardDescription><CardTitle className={`text-2xl ${balanceDue > 0 ? 'text-amber-200' : 'text-emerald-300'}`}>{balanceDue.toLocaleString()}</CardTitle></CardHeader><CardContent><p className="text-xs text-slate-400">Paid {balances.paid.toLocaleString()} of {balances.billed.toLocaleString()}</p></CardContent></Card>
          </section>
          <section className="grid gap-4 lg:grid-cols-2">
            <Card className="border-white/10 bg-[#0c1421]">
              <CardHeader><CardTitle className="text-white">Quran & Qaida progress</CardTitle><CardDescription>Latest progress shared by the Ustaz.</CardDescription></CardHeader>
              <CardContent>{latestLog ? <div className="space-y-2"><p className="text-lg font-semibold text-cyan-100">{latestLog.surah || latestLog.pageOrLesson || latestLog.lessonType}{latestLog.ayahRange ? ` · Ayah ${latestLog.ayahRange}` : ''}</p><p className="text-sm text-slate-400">{latestLog.juz ? `${latestLog.juz} · ` : ''}{latestLog.pageOrLesson ? `Page / Qaida lesson ${latestLog.pageOrLesson}` : 'No page or Qaida lesson number entered'}{latestLog.sabqi ? ` · Sabqi: ${latestLog.sabqi}` : ''}{latestLog.manzil ? ` · Manzil: ${latestLog.manzil}` : ''}</p><p className="text-xs text-slate-500">Updated {latestLog.date}</p></div> : <p className="text-sm text-slate-400">Progress will appear when the Ustaz posts the first daily entry.</p>}</CardContent>
            </Card>
            <Card className="border-white/10 bg-[#0c1421]">
              <CardHeader><CardTitle className="text-white">Recent exam results</CardTitle><CardDescription>Term and class results for {selectedChild?.name}.</CardDescription></CardHeader>
              <CardContent>{childData.exams.length ? <div className="space-y-3">{childData.exams.slice(0, 5).map((exam) => <div key={exam.id} className="flex items-center justify-between gap-3 border-b border-white/10 pb-3 last:border-0"><div><p className="font-medium text-slate-100">{exam.title}</p><p className="text-xs text-slate-500">{exam.type} · {exam.academicYear || 'Academic year not set'}</p></div><p className="text-right font-semibold text-violet-200">{exam.row.percentage.toFixed(1)}%<span className="block text-xs font-normal text-slate-500">{exam.row.total} points</span></p></div>)}</div> : <p className="text-sm text-slate-400">No exam results have been published for this child.</p>}</CardContent>
            </Card>
          </section>
          <Card className="border-white/10 bg-[#0c1421]">
            <CardHeader><CardTitle className="flex items-center gap-2 text-white"><Wallet className="h-5 w-5 text-amber-200" />Fee & payment history</CardTitle><CardDescription>Charges and payments for this child.</CardDescription></CardHeader>
            <CardContent>{childData.fees.length ? <div className="overflow-x-auto"><table className="w-full min-w-[500px] text-left text-sm"><thead className="text-slate-400"><tr><th className="p-3">Date</th><th className="p-3">Description</th><th className="p-3">Type</th><th className="p-3 text-right">Amount</th></tr></thead><tbody>{childData.fees.map((fee) => <tr key={fee.id} className="border-t border-white/10"><td className="p-3">{fee.date}</td><td className="p-3">{fee.description}</td><td className="p-3 capitalize">{fee.kind}</td><td className={`p-3 text-right font-medium ${fee.kind === 'payment' ? 'text-emerald-300' : 'text-amber-200'}`}>{fee.kind === 'payment' ? '−' : ''}{fee.amount.toLocaleString()}</td></tr>)}</tbody></table></div> : <p className="text-sm text-slate-400">No fee records have been added.</p>}</CardContent>
          </Card>
          <Card className="border-white/10 bg-[#0c1421]">
            <CardHeader><CardTitle className="text-white">Digital communication book</CardTitle><CardDescription>Read the daily update, sign after home revision, and reply to the Ustaz.</CardDescription></CardHeader>
            <CardContent className="space-y-4">{childData.logs.length ? childData.logs.slice(0, 25).map((log) => { const replies = Object.values(log.replies || {}).sort((a, b) => a.createdAt.localeCompare(b.createdAt)); return <article key={log.id} className="rounded-xl border border-white/10 bg-[#080f1b] p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-semibold text-white">{log.date} · {log.lessonType}</h3><p className="mt-1 text-sm text-slate-400">{log.surah ? `${log.surah}${log.ayahRange ? ` · Ayah ${log.ayahRange}` : ''}` : ''}{log.pageOrLesson ? ` · Page/lesson ${log.pageOrLesson}` : ''}</p></div>{log.acknowledgement ? <span className="inline-flex items-center gap-1 text-xs text-emerald-200"><CheckCircle2 className="h-4 w-4" />Seen {new Date(log.acknowledgement.acknowledgedAt).toLocaleString()}</span> : <Button type="button" size="sm" onClick={() => void signLog(log)} className="bg-cyan-400 text-slate-950 hover:bg-cyan-300">Seen & revised at home</Button>}</div>
                <p className="mt-2 text-sm text-slate-300">Evaluation: <span className="capitalize text-cyan-100">{log.evaluation}</span></p>{log.juz && <p className="mt-1 text-sm text-slate-400">{log.juz}</p>}
                {log.sabqi && <p className="mt-1 text-sm text-slate-400">Sabqi: {log.sabqi}</p>}{log.manzil && <p className="mt-1 text-sm text-slate-400">Manzil: {log.manzil}</p>}{log.homework && <p className="mt-2 text-sm text-slate-300">Homework: {log.homework}</p>}{(log.tags || []).length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{(log.tags || []).map((tag) => <span key={tag} className="rounded-full bg-cyan-300/10 px-2 py-1 text-xs text-cyan-100">{tag}</span>)}</div>}{log.remark && <p className="mt-2 text-sm text-slate-300">{log.remark}</p>}{log.voiceNote && <audio controls src={log.voiceNote} className="mt-3 h-9 max-w-full" />}
                <div className="mt-3 space-y-2">{replies.map((reply) => <div key={reply.id} className="rounded-lg bg-white/5 p-2 text-sm text-slate-300"><p><span className="font-medium text-cyan-200">{reply.authorName}:</span> {reply.message}</p>{reply.voiceNote && <audio controls src={reply.voiceNote} className="mt-2 h-8 max-w-full" />}</div>)}</div>
                <div className="mt-3 space-y-2"><Input value={replyDrafts[log.id] || ''} onChange={(e) => setReplyDrafts((drafts) => ({ ...drafts, [log.id]: e.target.value }))} placeholder="Send a short message to the Ustaz" /><VoiceNoteRecorder value={replyVoices[log.id] || ''} onChange={(value) => setReplyVoices((voices) => ({ ...voices, [log.id]: value }))} /><Button type="button" size="sm" variant="outline" disabled={sendingReply === log.id || (!(replyDrafts[log.id] || '').trim() && !replyVoices[log.id])} onClick={() => void sendReply(log)}><MessageCircle className="mr-2 h-4 w-4" />{sendingReply === log.id ? 'Sending…' : 'Reply'}</Button></div>
              </article>}) : <p className="text-sm text-slate-400">No daily notes yet. Check back after your child’s next lesson.</p>}</CardContent>
          </Card>
          <Card className="border-white/10 bg-[#0c1421]">
            <CardHeader><CardTitle className="flex items-center gap-2 text-white"><CalendarDays className="h-5 w-5 text-cyan-300" />Request leave / report an absence</CardTitle><CardDescription>Notify the class Ustaz and administration about an upcoming or current absence.</CardDescription></CardHeader>
            <CardContent><form onSubmit={submitLeave} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="leave-date">Date</Label><Input id="leave-date" type="date" value={leaveDate} onChange={(e) => setLeaveDate(e.target.value)} required /></div>
              <div className="space-y-2"><Label htmlFor="leave-reason">Reason</Label><select id="leave-reason" value={leaveReason} onChange={(e) => setLeaveReason(e.target.value)} className="h-10 w-full rounded-lg border border-white/10 bg-[#080f1b] px-3 text-sm"><option>Sickness</option><option>Family travel</option><option>Appointment</option><option>Other</option></select></div>
              <div className="space-y-2 md:col-span-2"><Label htmlFor="leave-note">Additional note (optional)</Label><Input id="leave-note" value={leaveNote} onChange={(e) => setLeaveNote(e.target.value)} placeholder="Add helpful details for the Ustaz" /></div>
              <div className="md:col-span-2"><Button type="submit" disabled={savingLeave} className="bg-cyan-400 text-slate-950 hover:bg-cyan-300">{savingLeave ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarDays className="mr-2 h-4 w-4" />}Send leave notice</Button></div>
            </form></CardContent>
          </Card>
        </>}
      </>}
    </div>
  )
}
