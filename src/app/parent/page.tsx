'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowUpRight, BookOpen as BookOpenIcon, CalendarDays, CheckCircle2, GraduationCap, Loader2, MessageCircle, Wallet } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { calculateFeeLedger, rtdb } from '@/lib/database'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { VoiceNoteRecorder } from '@/components/VoiceNoteRecorder'
import { DashboardTopBar } from '@/components/DashboardTopBar'
import { AnnouncementBell } from '@/components/AnnouncementBell'
import { usePreferences } from '@/context/PreferencesContext'
import { LocalizedDashboardContent } from '@/components/LocalizedDashboardContent'
import { ETHIOPIAN_MONTHS, ethiopianDateLabel } from '@/lib/ethiopianDate'
import type { Attendance, Class, FeeRecord, MutabaahEvaluation, MutabaahLog, ParentExamResult, Student } from '@/types'

const ETHIOPIAN_MONTH_NAMES = [
  'Meskerem', 'Tikimt', 'Hidar', 'Tahsas', 'Tir', 'Yekatit', 'Megabit',
  'Miazia', 'Ginbot', 'Sene', 'Hamle', 'Nehase', 'Pagume',
]

const EVALUATION_LABELS: Record<MutabaahEvaluation, string> = {
  excellent: 'Excellent',
  very_good: 'Very good',
  good: 'Good',
  practice: 'Study again',
}

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
  const { t, language } = usePreferences()
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
  const feeLedger = useMemo(() => calculateFeeLedger(childData.fees), [childData.fees])
  const balanceDue = feeLedger.balance
  const numberLocale = language === 'am' ? 'am-ET' : language === 'om' ? 'om-ET' : language === 'so' ? 'so-SO' : 'en-US'
  const formatAmount = (value: number) => value.toLocaleString(numberLocale)
  const feeStatusTone = feeLedger.status === 'ADVANCE CREDIT'
    ? 'border-violet-300/30 bg-violet-300/10 text-violet-100'
    : feeLedger.status === 'CLEARED / PAID'
      ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-100'
      : feeLedger.status === 'PARTIAL'
        ? 'border-amber-300/30 bg-amber-300/10 text-amber-100'
        : 'border-rose-300/30 bg-rose-300/10 text-rose-100'

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
      setNotice(`${t('Leave notice sent for')} ${selectedChild.name}.`)
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
      setNotice(t('Lesson marked as seen and revised at home.'))
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

  if (loadingChildren) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-cyan-300" /></div>

  return (
    <LocalizedDashboardContent>
    <>
    <DashboardTopBar
      role="parent"
      links={[
        { href: '/parent', label: 'Dashboard', icon: GraduationCap },
        { href: '/parent#communication-book', label: 'Daily book', icon: MessageCircle },
        { href: '/parent#fee-history', label: 'Fees', icon: Wallet },
        { href: '/parent#exam-results', label: 'Exam results', icon: GraduationCap },
        { href: '/parent#leave-request', label: 'Leave request', icon: CalendarDays },
      ]}
      alerts={null}
      announcement={<AnnouncementBell dark />}
    />
    <div className="mms-dashboard mms-parent-panel space-y-6">
      <header className="mms-parent-hero">
        <div className="relative z-10 max-w-2xl">
          <p className="mms-parent-eyebrow">{t('MMS1 · Family')}</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">{t('Parent Portal')}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-300">{t('Welcome back')}, {user?.name}. {t('Keep up with your children’s learning.')}</p>
        </div>
        <div className="mms-parent-hero-mark" aria-hidden="true"><BookOpenIcon className="h-10 w-10" /></div>
      </header>
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      {notice && <Alert variant="success"><AlertDescription>{notice}</AlertDescription></Alert>}
      {!children.length ? (
        <Card className="mms-parent-card border-amber-300/20 bg-[#0c1421]"><CardHeader><CardTitle className="text-white">{t('No students linked yet')}</CardTitle><CardDescription>{t('Please contact the Madrasah administrator. Your account email must match the parent email on each student’s record.')}</CardDescription></CardHeader></Card>
      ) : <>
        <div className="mms-parent-switcher">
          <div className="min-w-0 flex-1 space-y-2"><Label htmlFor="child-switcher">{t('Viewing child')}</Label><select id="child-switcher" value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className="h-11 w-full rounded-xl border border-white/10 bg-[#080f1b] px-3 text-sm text-slate-100 sm:max-w-sm">{children.map((child) => <option key={child.id} value={child.id}>{child.name}{child.className ? ` · ${child.className}` : ''}</option>)}</select></div>
          <div className="flex items-center gap-2 text-sm text-slate-400"><GraduationCap className="h-4 w-4 shrink-0 text-cyan-300" />{childData.classInfo?.name || selectedChild?.className || t('Class pending')}{childData.classInfo?.section ? ` · ${childData.classInfo.section}` : ''}</div>
        </div>
        {loadingData ? <div className="flex h-48 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-cyan-300" /></div> : <>
          <section id="child-overview" aria-label="Child overview" className="mms-stat-panel mms-parent-stats">
            <div className="mms-stat-cell"><span className="mms-stat-icon text-cyan-200"><CalendarDays className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-xs text-slate-400">{t('Today’s attendance')}</span><span className="block truncate text-base font-semibold capitalize text-white">{t(todayAttendance?.status || 'Not recorded')}</span></span><ArrowUpRight className="h-4 w-4 text-slate-500" /></div>
            <div className="mms-stat-cell"><span className="mms-stat-icon text-violet-200"><BookOpenIcon className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-xs text-slate-400">{t('Daily Mutaba’ah')}</span><span className="block truncate text-base font-semibold text-violet-100">{t(todayLog ? todayLog.evaluation === 'practice' ? 'Needs revision' : 'Lesson shared' : 'No update yet')}</span></span><ArrowUpRight className="h-4 w-4 text-slate-500" /></div>
            <div className="mms-stat-cell"><span className="mms-stat-icon text-amber-200"><Wallet className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-xs text-slate-400">{t('Fee balance')}</span><span className={`block truncate text-base font-semibold ${balanceDue > 0 ? 'text-amber-200' : 'text-emerald-300'}`}>{balanceDue < 0 ? `${t('Credit')} ${formatAmount(Math.abs(balanceDue))}` : formatAmount(balanceDue)}</span></span><ArrowUpRight className="h-4 w-4 text-slate-500" /></div>
            <div className="mms-stat-cell"><span className="mms-stat-icon text-cyan-200"><GraduationCap className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-xs text-slate-400">{t('Class')}</span><span className="block truncate text-base font-semibold text-white">{childData.classInfo?.name || selectedChild?.className || t('Pending')}</span></span><ArrowUpRight className="h-4 w-4 text-slate-500" /></div>
          </section>
          <section aria-label="Parent shortcuts">
            <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold text-slate-200">{t('Quick access')}</h2><span className="text-xs text-slate-500">{t('For your child')}</span></div>
            <div className="mms-dashboard-actions">
              <a href="#communication-book" className="mms-quick-link" data-accent="cyan"><span className="mms-quick-icon"><BookOpenIcon /></span><span>{t('Daily book')}</span></a>
              <a href="#fee-history" className="mms-quick-link" data-accent="yellow"><span className="mms-quick-icon"><Wallet /></span><span>{t('Fee history')}</span></a>
              <a href="#exam-results" className="mms-quick-link" data-accent="violet"><span className="mms-quick-icon"><GraduationCap /></span><span>{t('Exam results')}</span></a>
              <a href="#leave-request" className="mms-quick-link" data-accent="yellow"><span className="mms-quick-icon"><CalendarDays /></span><span>{t('Request leave')}</span></a>
            </div>
          </section>
          <section className="grid gap-4 lg:grid-cols-2">
            <Card id="exam-results" className="mms-parent-card scroll-mt-24 border-white/10 bg-[#0c1421]">
              <CardHeader><CardTitle className="text-white">{t('Quran & Qaida progress')}</CardTitle><CardDescription>{t('Latest progress shared by the Ustaz.')}</CardDescription></CardHeader>
              <CardContent>{latestLog ? <div className="space-y-2"><p className="text-lg font-semibold text-cyan-100">{latestLog.surah || latestLog.pageOrLesson || t(latestLog.lessonType === 'sabaq' ? 'Sabaq' : latestLog.lessonType === 'tilawah' ? 'Tilawah' : 'Qaida')}{latestLog.ayahRange ? ` · ${t('Ayah')} ${latestLog.ayahRange}` : ''}</p><p className="text-sm text-slate-400">{latestLog.juz ? `${latestLog.juz} · ` : ''}{latestLog.pageOrLesson ? `${t('Page / Qaida lesson')} ${latestLog.pageOrLesson}` : t('No page or Qaida lesson number entered')}</p><p className="text-xs text-slate-500">{t('Updated')} {latestLog.date}</p></div> : <p className="text-sm text-slate-400">{t('Progress will appear when the Ustaz posts the first daily entry.')}</p>}</CardContent>
            </Card>
            <Card className="mms-parent-card border-white/10 bg-[#0c1421]">
              <CardHeader><CardTitle className="text-white">{t('Recent exam results')}</CardTitle><CardDescription>{t('Term and class results for')} {selectedChild?.name}.</CardDescription></CardHeader>
              <CardContent>{childData.exams.length ? <div className="space-y-3">{childData.exams.slice(0, 5).map((exam) => <div key={exam.id} className="flex items-center justify-between gap-3 border-b border-white/10 pb-3 last:border-0"><div><p className="font-medium text-slate-100">{exam.title}</p><p className="text-xs text-slate-500">{exam.type} · {exam.academicYear || t('Academic year not set')}</p></div><p className="text-right font-semibold text-violet-200">{exam.row.percentage.toFixed(1)}%<span className="block text-xs font-normal text-slate-500">{exam.row.total} points</span></p></div>)}</div> : <p className="text-sm text-slate-400">{t('No exam results have been published for this child.')}</p>}</CardContent>
            </Card>
          </section>
          <Card id="fee-history" className="mms-parent-card scroll-mt-24 border-white/10 bg-[#0c1421]">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-white"><Wallet className="h-5 w-5 text-amber-200" />{t('Fee & payment history')}</CardTitle>
                <span className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-semibold ${feeStatusTone}`}>{feeLedger.status}</span>
              </div>
              <CardDescription>{t('Charges, payments, waivers, and the balance after each transaction for this child.')}</CardDescription>
            </CardHeader>
            <CardContent>{feeLedger.entries.length ? <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm"><thead className="text-slate-400"><tr><th className="p-3">{t('Date (Gregorian)')}</th><th className="p-3">{t('Date (Ethiopian)')}</th><th className="p-3">{t('Fee period')}</th><th className="p-3">{t('Description')}</th><th className="p-3">{t('Type')}</th><th className="p-3">{t('Payment info')}</th><th className="p-3 text-right">{t('Amount')}</th><th className="p-3 text-right">{t('Running Balance')}</th></tr></thead><tbody>{feeLedger.entries.map((fee) => <tr key={fee.id} className="border-t border-white/10"><td className="p-3">{fee.date}</td><td className="p-3">{ethiopianDateLabel(fee.date) || '—'}</td><td className="p-3">{fee.ethiopianMonth && fee.ethiopianYear ? `${ETHIOPIAN_MONTH_NAMES[fee.ethiopianMonth - 1] || ETHIOPIAN_MONTHS[fee.ethiopianMonth - 1]} ${fee.ethiopianYear}` : '—'}</td><td className="p-3">{fee.description}</td><td className="p-3">{t(fee.kind)}</td><td className="p-3">{fee.paymentMethod || fee.receiptNumber ? `${fee.paymentMethod || ''}${fee.receiptNumber ? ` · ${fee.receiptNumber}` : ''}` : '—'}</td><td className={`p-3 text-right font-medium ${fee.kind === 'charge' ? 'text-amber-200' : 'text-emerald-300'}`}>{fee.kind === 'charge' ? '' : '−'}{formatAmount(fee.amount)}</td><td className={`p-3 text-right font-medium ${fee.runningBalance > 0 ? 'text-amber-200' : fee.runningBalance < 0 ? 'text-violet-200' : 'text-emerald-300'}`}>{formatAmount(fee.runningBalance)}</td></tr>)}</tbody></table></div> : <p className="text-sm text-slate-400">{t('No fee records have been added.')}</p>}</CardContent>
          </Card>
          <Card id="communication-book" className="mms-parent-card scroll-mt-24 border-white/10 bg-[#0c1421]">
            <CardHeader><CardTitle className="text-white">{t('Digital communication book')}</CardTitle><CardDescription>{t('Read the daily update, sign after home revision, and reply to the Ustaz.')}</CardDescription></CardHeader>
            <CardContent className="space-y-4">{childData.logs.length ? childData.logs.slice(0, 25).map((log) => { const replies = Object.values(log.replies || {}).sort((a, b) => a.createdAt.localeCompare(b.createdAt)); const studyArea = log.studyArea || (log.lessonType === 'qaida' ? 'qaida' : log.lessonType === 'kitab' ? 'kitab' : 'quran'); const studyName = log.studyName || log.surah || ''; const range = log.rangeFrom && log.rangeTo ? `${log.rangeFrom}–${log.rangeTo}` : log.ayahRange || log.pageOrLesson || ''; const quranTracks = log.quranTracks || (studyArea === 'quran' ? [log.lessonType === 'tilawah' ? 'nezer' : 'hifz'] : []); return <article key={log.id} className="mms-parent-log"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-semibold text-white">{log.date} · {t(studyArea === 'qaida' ? 'Qaida' : studyArea === 'kitab' ? 'Kitab' : 'Quran')}</h3><p className="mt-1 text-sm text-slate-400">{studyName}{range ? ` · ${studyArea === 'quran' && !log.rangeFrom ? `${t('Ayah')} ` : ''}${range}` : ''}</p>{studyArea === 'quran' && quranTracks.includes('hifz') && log.hifzSurah && <p className="mt-1 text-sm text-slate-300">{t('Hifz')}: {log.hifzSurah}{log.hifzJuz ? ` · ${log.hifzJuz}` : ''}{log.hifzFromAyah && log.hifzToAyah ? ` · ${t('Ayah')} ${log.hifzFromAyah}–${log.hifzToAyah}` : ''}</p>}{studyArea === 'quran' && quranTracks.includes('nezer') && log.nezerSurah && <p className="mt-1 text-sm text-slate-300">{t('Nezer')}: {log.nezerSurah}{log.nezerFromAyah && log.nezerToAyah ? ` · ${t('Ayah')} ${log.nezerFromAyah}–${log.nezerToAyah}` : ''}</p>}</div>{log.acknowledgement ? <span className="inline-flex items-center gap-1 text-xs text-emerald-200"><CheckCircle2 className="h-4 w-4" />{t('Seen')} {new Date(log.acknowledgement.acknowledgedAt).toLocaleString()}</span> : <Button type="button" size="sm" onClick={() => void signLog(log)} className="bg-cyan-400 text-slate-950 hover:bg-cyan-300">{t('Seen & revised at home')}</Button>}</div>
                <p className="mt-2 text-sm text-slate-300">{t('Evaluation')}: <span className="text-cyan-100">{t(EVALUATION_LABELS[log.evaluation])}</span></p>{log.juz && <p className="mt-1 text-sm text-slate-400">{log.juz}</p>}
                {log.homework && <p className="mt-2 text-sm text-slate-300">Homework: {log.homework}</p>}{(log.tags || []).length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{(log.tags || []).map((tag) => <span key={tag} className="rounded-full bg-cyan-300/10 px-2 py-1 text-xs text-cyan-100">{tag}</span>)}</div>}{log.remark && <p className="mt-2 text-sm text-slate-300">{log.remark}</p>}{log.voiceNote && <audio controls src={log.voiceNote} className="mt-3 h-9 max-w-full" />}
                <div className="mt-3 space-y-2">{replies.map((reply) => <div key={reply.id} className="rounded-lg bg-white/5 p-2 text-sm text-slate-300"><p><span className="font-medium text-cyan-200">{reply.authorName}:</span> {reply.message}</p>{reply.voiceNote && <audio controls src={reply.voiceNote} className="mt-2 h-8 max-w-full" />}</div>)}</div>
                <div className="mt-3 space-y-2"><Input value={replyDrafts[log.id] || ''} onChange={(e) => setReplyDrafts((drafts) => ({ ...drafts, [log.id]: e.target.value }))} placeholder={t('Send a short message to the Ustaz')} /><VoiceNoteRecorder value={replyVoices[log.id] || ''} onChange={(value) => setReplyVoices((voices) => ({ ...voices, [log.id]: value }))} /><Button type="button" size="sm" variant="outline" disabled={sendingReply === log.id || (!(replyDrafts[log.id] || '').trim() && !replyVoices[log.id])} onClick={() => void sendReply(log)}><MessageCircle className="mr-2 h-4 w-4" />{sendingReply === log.id ? t('Sending…') : t('Reply')}</Button></div>
              </article>}) : <p className="text-sm text-slate-400">{t('No daily notes yet. Check back after your child’s next lesson.')}</p>}</CardContent>
          </Card>
          <Card id="leave-request" className="mms-parent-card scroll-mt-24 border-white/10 bg-[#0c1421]">
            <CardHeader><CardTitle className="flex items-center gap-2 text-white"><CalendarDays className="h-5 w-5 text-cyan-300" />{t('Request leave / report an absence')}</CardTitle><CardDescription>{t('Notify the class Ustaz and administration about an upcoming or current absence.')}</CardDescription></CardHeader>
            <CardContent><form onSubmit={submitLeave} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="leave-date">{t('Date')}</Label><Input id="leave-date" type="date" value={leaveDate} onChange={(e) => setLeaveDate(e.target.value)} required /></div>
              <div className="space-y-2"><Label htmlFor="leave-reason">{t('Reason')}</Label><select id="leave-reason" value={leaveReason} onChange={(e) => setLeaveReason(e.target.value)} className="h-10 w-full rounded-lg border border-white/10 bg-[#080f1b] px-3 text-sm"><option value="Sickness">{t('Sickness')}</option><option value="Family travel">{t('Family travel')}</option><option value="Appointment">{t('Appointment')}</option><option value="Other">{t('Other')}</option></select></div>
              <div className="space-y-2 md:col-span-2"><Label htmlFor="leave-note">{t('Additional note (optional)')}</Label><Input id="leave-note" value={leaveNote} onChange={(e) => setLeaveNote(e.target.value)} placeholder={t('Add helpful details for the Ustaz')} /></div>
              <div className="md:col-span-2"><Button type="submit" disabled={savingLeave} className="bg-cyan-400 text-slate-950 hover:bg-cyan-300">{savingLeave ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarDays className="mr-2 h-4 w-4" />}{t('Send leave notice')}</Button></div>
            </form></CardContent>
          </Card>
        </>}
      </>}
    </div>
    </>
    </LocalizedDashboardContent>
  )
}
