'use client'

import { LocalizedDashboardContent } from '@/components/LocalizedDashboardContent'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Plus, Search, Users } from 'lucide-react'
import { auth } from '@/lib/firebase/config'
import { rtdb } from '@/lib/database'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Student, User } from '@/types'

type ParentWithChildren = {
  parent: User
  children: Student[]
}

export default function ParentsPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [parents, setParents] = useState<ParentWithChildren[]>([])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([])
  const [studentSearch, setStudentSearch] = useState('')
  const [studentToLinkByParent, setStudentToLinkByParent] = useState<Record<string, string>>({})
  const [linkingParentId, setLinkingParentId] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [allUsers, allStudents] = await Promise.all([
        rtdb.getAllUsers(),
        rtdb.getAllStudents(),
      ])
      const activeStudents = allStudents
        .filter((student) => student.isActive !== false)
        .sort((a, b) => a.name.localeCompare(b.name))
      const parentUsers = allUsers.filter((user) => user.role === 'parent')
      const linkedChildren = await Promise.all(
        parentUsers.map((parent) => rtdb.getParentStudentIds(parent.uid))
      )
      const studentsById = new Map(activeStudents.map((student) => [student.id, student]))
      setStudents(activeStudents)
      setParents(parentUsers.map((parent, index) => ({
        parent,
        children: linkedChildren[index]
          .map((studentId) => studentsById.get(studentId))
          .filter((student): student is Student => Boolean(student)),
      })).sort((a, b) => a.parent.name.localeCompare(b.parent.name)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load parents and students.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const filteredStudents = useMemo(() => {
    const term = studentSearch.trim().toLowerCase()
    if (!term) return students
    return students.filter((student) =>
      `${student.name} ${student.rollNumber || ''} ${student.className || ''} ${student.parentName || ''}`
        .toLowerCase()
        .includes(term)
    )
  }, [studentSearch, students])

  const toggleStudent = (studentId: string) => {
    setSelectedStudentIds((current) => current.includes(studentId)
      ? current.filter((id) => id !== studentId)
      : [...current, studentId])
  }

  const handleCreateParent = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setNotice('')
    if (selectedStudentIds.length === 0) {
      setError('Select at least one child to link to this parent.')
      return
    }

    setSaving(true)
    try {
      const idToken = await auth.currentUser?.getIdToken()
      if (!idToken) throw new Error('Your admin session has expired. Sign in again and retry.')
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
          phone: phone.trim() || undefined,
          role: 'parent',
          studentIds: selectedStudentIds,
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Could not create the parent account.')

      setNotice(`Parent account created and linked to ${selectedStudentIds.length} ${selectedStudentIds.length === 1 ? 'child' : 'children'}.`)
      setName('')
      setEmail('')
      setPhone('')
      setPassword('')
      setSelectedStudentIds([])
      setStudentSearch('')
      await loadData()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the parent account.')
    } finally {
      setSaving(false)
    }
  }

  const linkChildToParent = async (parent: User) => {
    const studentId = studentToLinkByParent[parent.uid]
    if (!studentId) {
      setError('Choose a child to link to this account.')
      return
    }

    setError('')
    setNotice('')
    setLinkingParentId(parent.uid)
    try {
      const idToken = await auth.currentUser?.getIdToken()
      if (!idToken) throw new Error('Your admin session has expired. Sign in again and retry.')
      const response = await fetch(`/api/admin/users/${encodeURIComponent(parent.uid)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ studentIds: [studentId] }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Could not link the child.')

      const childName = students.find((student) => student.id === studentId)?.name || 'Child'
      setNotice(`${childName} linked to ${parent.name}.`)
      setStudentToLinkByParent((current) => ({ ...current, [parent.uid]: '' }))
      await loadData()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not link the child.')
    } finally {
      setLinkingParentId('')
    }
  }

  if (loading) {
    return <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-cyan-300" /></div>
  }

  return (
    <LocalizedDashboardContent>
    <div className="mms-dashboard mms-parent-admin-page space-y-6">
      <header className="mms-parent-admin-hero">
        <span className="mms-parent-admin-mark"><Users className="h-6 w-6" /></span>
        <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Family accounts</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-white">Parents</h1>
        <p className="mt-1 text-sm text-slate-400">Create a parent login, assign children, and manage sibling links.</p>
        </div>
        <span className="mms-parent-admin-count">{parents.length} accounts</span>
      </header>

      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      {notice && <Alert variant="success"><AlertDescription>{notice}</AlertDescription></Alert>}

      <Card className="mms-parent-admin-card border-white/10 bg-[#0c1421]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white"><Plus className="h-5 w-5 text-cyan-300" />Register parent</CardTitle>
          <CardDescription>Create sign-in credentials and select all of this parent’s children. Selecting a child already linked to another account transfers that link.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateParent} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="parent-name">Parent full name</Label>
                <Input id="parent-name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="parent-email">Email / sign-in</Label>
                <Input id="parent-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="parent-phone">Phone (optional)</Label>
                <Input id="parent-phone" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="parent-password">Temporary password</Label>
                <Input id="parent-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={6} required />
              </div>
            </div>

            <section aria-labelledby="student-link-heading" className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 id="student-link-heading" className="font-semibold text-slate-100">Assign children</h2>
                  <p className="text-xs text-slate-400">Selected: {selectedStudentIds.length}</p>
                </div>
                <div className="relative w-full sm:max-w-xs">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    value={studentSearch}
                    onChange={(event) => setStudentSearch(event.target.value)}
                    placeholder="Search students..."
                    aria-label="Search students"
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="max-h-72 space-y-1 overflow-y-auto rounded-xl border border-white/10 bg-[#080f1b] p-2">
                {!filteredStudents.length ? (
                  <p className="p-3 text-sm text-slate-400">No active students found.</p>
                ) : filteredStudents.map((student) => (
                  <label key={student.id} className="flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-white/5">
                    <input
                      type="checkbox"
                      checked={selectedStudentIds.includes(student.id)}
                      onChange={() => toggleStudent(student.id)}
                      className="mt-1 h-4 w-4 shrink-0 accent-cyan-400"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-100">{student.name}</span>
                      <span className="block truncate text-xs text-slate-400">
                        {student.className || 'Class not set'}{student.rollNumber ? ` · Roll ${student.rollNumber}` : ''}
                        {student.parentEmail ? ` · Current parent: ${student.parentEmail}` : ' · No parent email assigned'}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </section>

            <Button type="submit" disabled={saving || !students.length} className="bg-cyan-400 font-semibold text-slate-950 hover:bg-cyan-300">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              {saving ? 'Creating parent...' : 'Create parent and link children'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="mms-parent-admin-card border-white/10 bg-[#0c1421]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white"><Users className="h-5 w-5 text-violet-300" />Registered parents ({parents.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!parents.length ? (
            <p className="py-5 text-center text-sm text-slate-400">No parent accounts registered yet.</p>
          ) : parents.map(({ parent, children }) => (
            <article key={parent.uid} className="mms-parent-account-card">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="mms-parent-avatar" aria-hidden="true">{parent.name.trim().slice(0, 1).toUpperCase()}</span>
                  <div className="min-w-0">
                  <h2 className="truncate font-semibold text-slate-100">{parent.name}</h2>
                  <p className="text-sm text-slate-400">{parent.email}{parent.phone ? ` · ${parent.phone}` : ''}</p>
                  </div>
                </div>
                <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-xs text-cyan-100">
                  {children.length} {children.length === 1 ? 'child' : 'children'}
                </span>
              </div>
              {children.length > 0 && <p className="mt-3 text-sm text-slate-300">{children.map((student) => student.name).join(', ')}</p>}
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <select
                  aria-label={`Choose a child to link to ${parent.name}`}
                  value={studentToLinkByParent[parent.uid] || ''}
                  onChange={(event) => setStudentToLinkByParent((current) => ({ ...current, [parent.uid]: event.target.value }))}
                  className="h-10 min-w-0 flex-1 rounded-lg border border-white/10 bg-[#080f1b] px-3 text-sm text-slate-100"
                >
                  <option value="">Link another child...</option>
                  {students.filter((student) => !children.some((linked) => linked.id === student.id)).map((student) => (
                    <option key={student.id} value={student.id}>{student.name}{student.parentEmail && student.parentEmail !== parent.email ? ` · currently linked to ${student.parentEmail}` : ''}</option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="outline"
                  disabled={linkingParentId === parent.uid || !studentToLinkByParent[parent.uid]}
                  onClick={() => void linkChildToParent(parent)}
                  className="border-cyan-300/30 text-cyan-100 hover:bg-cyan-300/10 hover:text-cyan-50"
                >
                  {linkingParentId === parent.uid ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                  Link child
                </Button>
              </div>
            </article>
          ))}
        </CardContent>
      </Card>
    </div>
    </LocalizedDashboardContent>
  )
}
