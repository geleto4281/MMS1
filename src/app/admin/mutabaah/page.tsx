'use client'

import { LocalizedDashboardContent } from '@/components/LocalizedDashboardContent'
import { useEffect, useMemo, useState } from 'react'
import { BookOpen, CheckCircle2, Loader2, Send, Trash2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/context/AuthContext'
import { rtdb } from '@/lib/database'
import { QURAN_SURAHS } from '@/lib/mutabaah'
import type { Class, MutabaahEvaluation, MutabaahLog, MutabaahStudyArea, Student } from '@/types'

type AdminMutabaahEntry = {
  log: MutabaahLog
  student: Student
  className: string
}

const EVALUATION_LABELS: Record<MutabaahEvaluation, string> = {
  excellent: 'Excellent',
  very_good: 'Very good',
  good: 'Good',
  practice: 'Study again',
}

export default function AdminMutabaahPage() {
  const { user } = useAuth()
  const [entries, setEntries] = useState<AdminMutabaahEntry[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [classFilter, setClassFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('')
  const [classId, setClassId] = useState('')
  const [studentId, setStudentId] = useState('all')
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
  const [evaluation, setEvaluation] = useState<MutabaahEvaluation>('good')
  const [remark, setRemark] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingAudio, setDeletingAudio] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const [students, classList] = await Promise.all([
          rtdb.getAllStudents(),
          rtdb.getAllClasses(),
        ])
        const classNames = new Map(classList.map((item) => [item.id, item.name]))
        const rows = await Promise.all(students.map(async (student) => {
          const logs = await rtdb.getMutabaahLogs(student.id)
          return logs.map((log) => ({
            log,
            student,
            className: classNames.get(log.classId) || student.className || 'Class not set',
          }))
        }))
        if (!active) return
        setClasses(classList)
        setStudents(students.filter((student) => student.isActive !== false))
        setClassId(classList.find((item) => item.isActive !== false)?.id || classList[0]?.id || '')
        setEntries(rows.flat().sort((a, b) =>
          b.log.date.localeCompare(a.log.date) || b.log.createdAt.localeCompare(a.log.createdAt)
        ))
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Could not load student performance records.')
      } finally {
        if (active) setLoading(false)
      }
    }

    void load()
    return () => { active = false }
  }, [])

  const formStudents = useMemo(
    () => students.filter((student) => student.classId === classId),
    [students, classId]
  )

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

  const createEntry = async (event: React.FormEvent) => {
    event.preventDefault()
    const targets = studentId === 'all' ? formStudents : formStudents.filter((student) => student.id === studentId)
    if (!user || !targets.length) {
      setError('Select a class with at least one active student.')
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
      const common = {
        classId,
        date,
        teacherId: user.uid,
        teacherName: user.name || 'Administration',
        evaluation,
        tags: [],
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
        return logs
      }
      await Promise.all(targets.flatMap((student) => createLogsForStudent(student)
        .map((log) => rtdb.createMutabaahLog(student.id, log))))

      const newRows = await Promise.all(targets.map(async (student) => {
        const logs = await rtdb.getMutabaahLogs(student.id)
        return logs.map((log) => ({
          log,
          student,
          className: classes.find((item) => item.id === log.classId)?.name || student.className || 'Class not set',
        }))
      }))
      setEntries((current) => {
        const byId = new Map(current.map((entry) => [`${entry.student.id}:${entry.log.id}`, entry]))
        for (const entry of newRows.flat()) byId.set(`${entry.student.id}:${entry.log.id}`, entry)
        return [...byId.values()].sort((a, b) =>
          b.log.date.localeCompare(a.log.date) || b.log.createdAt.localeCompare(a.log.createdAt)
        )
      })
      setNotice(`Shared the daily performance with ${targets.length === 1 ? targets[0].name : `${targets.length} students`}.`)
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
      setRemark('')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save the Mutaba’ah entry.')
    } finally {
      setSaving(false)
    }
  }

  const filteredEntries = useMemo(() => entries.filter(({ log, student }) =>
    (classFilter === 'all' || log.classId === classFilter || student.classId === classFilter)
    && (!dateFilter || log.date === dateFilter)
  ), [entries, classFilter, dateFilter])

  const acknowledgedCount = filteredEntries.filter(({ log }) => Boolean(log.acknowledgement)).length
  const todayString = new Date().toISOString().slice(0, 10)
  const todayCount = filteredEntries.filter(({ log }) => log.date === todayString).length

  const deleteVoiceNote = async (entry: AdminMutabaahEntry) => {
    if (!entry.log.voiceNote || !window.confirm('Delete this voice note? Parents will no longer be able to play it.')) return
    setDeletingAudio(entry.log.id)
    setError('')
    try {
      await rtdb.removeMutabaahVoiceNote(entry.student.id, entry.log.id)
      setEntries((current) => current.map((item) =>
        item.student.id === entry.student.id && item.log.id === entry.log.id
          ? { ...item, log: { ...item.log, voiceNote: undefined } }
          : item
      ))
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Could not delete the voice note.')
    } finally {
      setDeletingAudio('')
    }
  }

  return (
    <LocalizedDashboardContent>
      <div className="mms-dashboard space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300">Administration</p>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
              <BookOpen className="h-6 w-6 text-cyan-300" />
              Mutaba’ah
            </h1>
            <p className="mt-1 text-sm text-slate-400">Review daily Quran, Qaida, and Kitab updates shared with families.</p>
          </div>
        </header>

        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        {notice && <Alert variant="success"><AlertDescription>{notice}</AlertDescription></Alert>}

        <Card className="border-white/10 bg-[#0c1421]">
          <CardHeader>
            <CardTitle className="text-white">Share daily performance</CardTitle>
            <CardDescription>Create a Mutaba’ah update for one student or everyone in a class. It will appear in the linked parents’ portal.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={createEntry} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="admin-mutabaah-class">Class / Halqah</Label>
                <select id="admin-mutabaah-class" value={classId} onChange={(event) => { setClassId(event.target.value); setStudentId('all') }} required className="h-10 w-full rounded-lg border border-white/10 bg-[#080f1b] px-3 text-sm text-white">
                  <option value="" disabled>Select a class</option>
                  {classes.filter((item) => item.isActive !== false).map((item) => <option key={item.id} value={item.id}>{item.name}{item.section ? ` · ${item.section}` : ''}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-mutabaah-student">Send to</Label>
                <select id="admin-mutabaah-student" value={studentId} onChange={(event) => setStudentId(event.target.value)} disabled={!formStudents.length} className="h-10 w-full rounded-lg border border-white/10 bg-[#080f1b] px-3 text-sm text-white">
                  <option value="all">Whole class ({formStudents.length})</option>
                  {formStudents.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-mutabaah-date">Date</Label>
                <Input id="admin-mutabaah-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
              </div>
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
                  <div className="space-y-2"><Label htmlFor="admin-mutabaah-hifz-surah">Memorized Surah</Label><select id="admin-mutabaah-hifz-surah" value={hifzSurah} onChange={(event) => setHifzSurah(event.target.value)} required className="h-10 w-full rounded-lg border border-white/10 bg-[#080f1b] px-3 text-sm"><option value="">Select a Surah</option>{QURAN_SURAHS.map((name) => <option key={name} value={name}>{name}</option>)}</select></div>
                  <div className="space-y-2"><Label htmlFor="admin-mutabaah-hifz-juz">Memorized Juz (optional)</Label><select id="admin-mutabaah-hifz-juz" value={hifzJuz} onChange={(event) => setHifzJuz(event.target.value)} className="h-10 w-full rounded-lg border border-white/10 bg-[#080f1b] px-3 text-sm"><option value="">Not specified</option>{Array.from({ length: 30 }, (_, index) => <option key={index + 1} value={`Juz ${index + 1}`}>Juz {index + 1}</option>)}</select></div>
                  <div className="space-y-2"><Label htmlFor="admin-mutabaah-hifz-from">Hifz from Ayah</Label><Input id="admin-mutabaah-hifz-from" type="number" min="1" value={hifzFromAyah} onChange={(event) => setHifzFromAyah(event.target.value)} required placeholder="Starting ayah" /></div>
                  <div className="space-y-2"><Label htmlFor="admin-mutabaah-hifz-to">Hifz to Ayah</Label><Input id="admin-mutabaah-hifz-to" type="number" min="1" value={hifzToAyah} onChange={(event) => setHifzToAyah(event.target.value)} required placeholder="Ending ayah" /></div>
                </div>}
                {quranTracks.includes('nezer') && <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2"><Label htmlFor="admin-mutabaah-nezer-surah">Nezer Surah</Label><select id="admin-mutabaah-nezer-surah" value={nezerSurah} onChange={(event) => setNezerSurah(event.target.value)} required className="h-10 w-full rounded-lg border border-white/10 bg-[#080f1b] px-3 text-sm"><option value="">Select a Surah</option>{QURAN_SURAHS.map((name) => <option key={name} value={name}>{name}</option>)}</select></div>
                  <div className="space-y-2"><Label htmlFor="admin-mutabaah-nezer-from">Nezer from Ayah</Label><Input id="admin-mutabaah-nezer-from" type="number" min="1" value={nezerFromAyah} onChange={(event) => setNezerFromAyah(event.target.value)} required placeholder="Starting ayah" /></div>
                  <div className="space-y-2"><Label htmlFor="admin-mutabaah-nezer-to">Nezer to Ayah</Label><Input id="admin-mutabaah-nezer-to" type="number" min="1" value={nezerToAyah} onChange={(event) => setNezerToAyah(event.target.value)} required placeholder="Ending ayah" /></div>
                </div>}
              </fieldset>}
              {studyAreas.includes('qaida') && <fieldset className="grid gap-3 rounded-xl border border-white/10 p-3 sm:grid-cols-2 md:col-span-2">
                <legend className="px-1 text-sm font-medium">Qaida</legend>
                <div className="space-y-2"><Label htmlFor="admin-mutabaah-qaida-name">Qaida / level</Label><Input id="admin-mutabaah-qaida-name" value={qaidaName} onChange={(event) => setQaidaName(event.target.value)} placeholder="e.g. Qaida Noorania" required /></div>
                <div className="space-y-2"><Label htmlFor="admin-mutabaah-qaida-from">From lesson / page</Label><Input id="admin-mutabaah-qaida-from" value={qaidaFrom} onChange={(event) => setQaidaFrom(event.target.value)} required /></div>
                <div className="space-y-2"><Label htmlFor="admin-mutabaah-qaida-to">To lesson / page</Label><Input id="admin-mutabaah-qaida-to" value={qaidaTo} onChange={(event) => setQaidaTo(event.target.value)} required /></div>
              </fieldset>}
              {studyAreas.includes('kitab') && <fieldset className="grid gap-3 rounded-xl border border-white/10 p-3 sm:grid-cols-2 md:col-span-2">
                <legend className="px-1 text-sm font-medium">Kitab</legend>
                <div className="space-y-2"><Label htmlFor="admin-mutabaah-kitab-name">Kitab name</Label><Input id="admin-mutabaah-kitab-name" value={kitabName} onChange={(event) => setKitabName(event.target.value)} placeholder="e.g. Kitab al-Adab" required /></div>
                <div className="space-y-2"><Label htmlFor="admin-mutabaah-kitab-from">From page / lesson</Label><Input id="admin-mutabaah-kitab-from" value={kitabFrom} onChange={(event) => setKitabFrom(event.target.value)} required /></div>
                <div className="space-y-2"><Label htmlFor="admin-mutabaah-kitab-to">To page / lesson</Label><Input id="admin-mutabaah-kitab-to" value={kitabTo} onChange={(event) => setKitabTo(event.target.value)} required /></div>
              </fieldset>}
              <fieldset className="space-y-2 md:col-span-2">
                <legend className="text-sm font-medium text-slate-200">Performance rating</legend>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {([
                    ['excellent', 'Excellent'],
                    ['very_good', 'Very good'],
                    ['good', 'Good'],
                    ['practice', 'Study again'],
                  ] as const).map(([value, label]) => (
                    <button key={value} type="button" aria-pressed={evaluation === value} onClick={() => setEvaluation(value)} className={`min-h-11 rounded-xl border px-3 py-2 text-sm font-medium ${evaluation === value ? 'border-cyan-300/60 bg-cyan-300/15 text-cyan-100' : 'border-white/10 bg-[#080f1b] text-slate-400 hover:border-white/25'}`}>{label}</button>
                  ))}
                </div>
              </fieldset>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="admin-mutabaah-remark">Note for parent (optional)</Label>
                <Input id="admin-mutabaah-remark" value={remark} onChange={(event) => setRemark(event.target.value)} placeholder="Short feedback or what to revise at home" />
              </div>
              <div className="md:col-span-2">
                <Button type="submit" disabled={saving || loading || !formStudents.length}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  {saving ? 'Sending…' : 'Share with parent'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <section className="grid gap-3 sm:grid-cols-3" aria-label="Mutaba’ah summary">
          <Card className="border-white/10 bg-[#0c1421]">
            <CardContent className="p-4">
              <p className="text-xs text-slate-400">Entries shown</p>
              <p className="mt-1 text-2xl font-bold text-white">{filteredEntries.length}</p>
            </CardContent>
          </Card>
          <Card className="border-white/10 bg-[#0c1421]">
            <CardContent className="p-4">
              <p className="text-xs text-slate-400">Today</p>
              <p className="mt-1 text-2xl font-bold text-cyan-200">{todayCount}</p>
            </CardContent>
          </Card>
          <Card className="border-white/10 bg-[#0c1421]">
            <CardContent className="p-4">
              <p className="text-xs text-slate-400">Parent sign-offs</p>
              <p className="mt-1 text-2xl font-bold text-emerald-200">{acknowledgedCount} / {filteredEntries.length}</p>
            </CardContent>
          </Card>
        </section>

        <Card className="border-white/10 bg-[#0c1421]">
          <CardHeader>
            <CardTitle className="text-white">Student performance reports</CardTitle>
            <CardDescription>Teacher entries appear here and in the linked child’s parent portal.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-5 grid gap-3 sm:grid-cols-2">
              <label className="space-y-2 text-sm font-medium text-slate-300" htmlFor="mutabaah-class-filter">
                Class
                <select
                  id="mutabaah-class-filter"
                  value={classFilter}
                  onChange={(event) => setClassFilter(event.target.value)}
                  className="h-10 w-full rounded-lg border border-white/10 bg-[#080f1b] px-3 text-sm text-white"
                >
                  <option value="all">All classes</option>
                  {classes.map((item) => <option key={item.id} value={item.id}>{item.name}{item.section ? ` · ${item.section}` : ''}</option>)}
                </select>
              </label>
              <label className="space-y-2 text-sm font-medium text-slate-300" htmlFor="mutabaah-date-filter">
                Date
                <input
                  id="mutabaah-date-filter"
                  type="date"
                  value={dateFilter}
                  onChange={(event) => setDateFilter(event.target.value)}
                  className="h-10 w-full rounded-lg border border-white/10 bg-[#080f1b] px-3 text-sm text-white"
                />
              </label>
            </div>

            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-7 w-7 animate-spin text-cyan-300" /></div>
            ) : !filteredEntries.length ? (
              <p className="py-8 text-center text-sm text-slate-400">No Mutaba’ah entries match these filters.</p>
            ) : (
              <div className="space-y-3">
                {filteredEntries.map(({ log, student, className }) => {
                  const studyArea = log.studyArea || (log.lessonType === 'qaida' ? 'qaida' : log.lessonType === 'kitab' ? 'kitab' : 'quran')
                  const studyName = log.studyName || log.surah || log.homework || '—'
                  const range = log.rangeFrom && log.rangeTo
                    ? `${log.rangeFrom}–${log.rangeTo}`
                    : log.ayahRange || log.pageOrLesson || '—'
                  return (
                    <article key={`${student.id}-${log.id}`} className="rounded-xl border border-white/10 bg-[#080f1b] p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h2 className="font-semibold text-white">{student.name}</h2>
                          <p className="mt-1 text-xs text-slate-400">{className} · {log.date} · {log.teacherName}</p>
                        </div>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${log.acknowledgement ? 'bg-emerald-400/10 text-emerald-200' : 'bg-amber-300/10 text-amber-200'}`}>
                          {log.acknowledgement ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
                          {log.acknowledgement ? `Seen by ${log.acknowledgement.parentName}` : 'Awaiting parent sign-off'}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-cyan-300/10 px-2 py-1 text-xs font-medium capitalize text-cyan-100">{studyArea}</span>
                        <span className="text-sm text-slate-200">{studyName}</span>
                        <span className="text-sm text-slate-400">From–to: {range}</span>
                        <span className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-slate-200">{EVALUATION_LABELS[log.evaluation]}</span>
                      </div>
                      {log.hifzSurah && <p className="mt-2 text-sm text-violet-200">Hifz: {log.hifzSurah}{log.hifzJuz ? ` · ${log.hifzJuz}` : ''}{log.hifzFromAyah && log.hifzToAyah ? ` · Ayah ${log.hifzFromAyah}–${log.hifzToAyah}` : ''}</p>}
                      {log.nezerSurah && <p className="mt-1 text-sm text-cyan-200">Nezer: {log.nezerSurah}{log.nezerFromAyah && log.nezerToAyah ? ` · Ayah ${log.nezerFromAyah}–${log.nezerToAyah}` : ''}</p>}
                      {log.homework && <p className="mt-2 text-sm text-slate-300">Homework: {log.homework}</p>}
                      {log.remark && <p className="mt-2 text-sm text-slate-300">{log.remark}</p>}
                      {log.voiceNote && <div className="mt-3 flex flex-wrap items-center gap-2"><audio controls src={log.voiceNote} className="h-9 max-w-full" /><Button type="button" size="sm" variant="outline" disabled={deletingAudio === log.id} onClick={() => void deleteVoiceNote({ log, student, className })}><Trash2 className="mr-2 h-4 w-4" />{deletingAudio === log.id ? 'Deleting…' : 'Delete audio'}</Button></div>}
                    </article>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </LocalizedDashboardContent>
  )
}
