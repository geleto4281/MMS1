'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, Loader2, Plus, Wallet } from 'lucide-react'
import { rtdb } from '@/lib/database'
import { useAuth } from '@/context/AuthContext'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { FeeRecord, Student } from '@/types'

export default function FeesPage() {
  const { user } = useAuth()
  const [students, setStudents] = useState<Student[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [records, setRecords] = useState<FeeRecord[]>([])
  const [kind, setKind] = useState<'charge' | 'payment'>('charge')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    rtdb.getAllStudents()
      .then((list) => {
        const active = list.filter((student) => student.isActive !== false).sort((a, b) => a.name.localeCompare(b.name))
        setStudents(active)
        setSelectedId(active[0]?.id || '')
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load students.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!selectedId) {
      setRecords([])
      return
    }
    let active = true
    rtdb.getFeeRecords(selectedId)
      .then((data) => { if (active) setRecords(data) })
      .catch((e) => { if (active) setError(e instanceof Error ? e.message : 'Could not load fee history.') })
    return () => { active = false }
  }, [selectedId, notice])

  const totals = useMemo(() => records.reduce(
    (sum, record) => ({
      billed: sum.billed + (record.kind === 'charge' ? record.amount : 0),
      paid: sum.paid + (record.kind === 'payment' ? record.amount : 0),
    }),
    { billed: 0, paid: 0 }
  ), [records])
  const balance = totals.billed - totals.paid

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    const value = Number(amount)
    if (!selectedId || !Number.isFinite(value) || value <= 0 || !description.trim()) {
      setError('Select a student and enter a valid amount and description.')
      return
    }
    if (kind === 'payment' && value > balance) {
      setError('Payment cannot be greater than the outstanding balance.')
      return
    }
    setSaving(true)
    setError('')
    setNotice('')
    try {
      await rtdb.createFeeRecord(selectedId, {
        studentId: selectedId,
        kind,
        amount: value,
        description: description.trim(),
        date,
        createdAt: new Date().toISOString(),
        createdBy: user?.uid || '',
        createdByName: user?.name || 'Admin',
      })
      setNotice(`${kind === 'charge' ? 'Fee charge' : 'Payment'} recorded.`)
      setAmount('')
      setDescription('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save this fee record.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-cyan-300" /></div>

  return (
    <div className="mms-dashboard space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-white">Fees & Payments</h1>
        <p className="mt-1 text-slate-400">Record student charges and payments; parents can view each child’s ledger.</p>
      </header>
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      {notice && <Alert variant="success"><AlertDescription>{notice}</AlertDescription></Alert>}
      {!students.length ? (
        <Card><CardContent className="p-6 text-slate-400">No active students are available.</CardContent></Card>
      ) : (
        <>
          <div className="flex flex-col gap-2 sm:max-w-md">
            <Label htmlFor="fee-student">Student</Label>
            <select id="fee-student" value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className="h-10 rounded-lg border border-white/10 bg-[#0c1421] px-3 text-sm text-slate-100">
              {students.map((student) => <option key={student.id} value={student.id}>{student.name} · {student.rollNumber || student.className || 'Student'}</option>)}
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { title: 'Total charges', amount: totals.billed, tone: 'text-cyan-200' },
              { title: 'Paid', amount: totals.paid, tone: 'text-emerald-300' },
              { title: 'Balance due', amount: balance, tone: balance > 0 ? 'text-amber-200' : 'text-emerald-300' },
            ].map((item) => (
              <Card key={item.title} className="border-white/10 bg-[#0c1421]">
                <CardHeader className="pb-2"><CardDescription>{item.title}</CardDescription><CardTitle className={`text-2xl ${item.tone}`}>{item.amount.toLocaleString()}</CardTitle></CardHeader>
              </Card>
            ))}
          </div>
          <Card className="border-white/10 bg-[#0c1421]">
            <CardHeader><CardTitle className="flex items-center gap-2 text-white"><Wallet className="h-5 w-5 text-cyan-300" /> Add ledger entry</CardTitle><CardDescription>Use a charge for a new fee or a payment for money received.</CardDescription></CardHeader>
            <CardContent>
              <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2"><Label htmlFor="fee-kind">Entry type</Label><select id="fee-kind" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className="h-10 w-full rounded-lg border border-white/10 bg-[#080f1b] px-3 text-sm"><option value="charge">Fee charge</option><option value="payment">Payment received</option></select></div>
                <div className="space-y-2"><Label htmlFor="fee-amount">Amount</Label><Input id="fee-amount" type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required /></div>
                <div className="space-y-2"><Label htmlFor="fee-description">Description</Label><Input id="fee-description" placeholder="e.g. Monthly tuition" value={description} onChange={(e) => setDescription(e.target.value)} required /></div>
                <div className="space-y-2"><Label htmlFor="fee-date">Date</Label><Input id="fee-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></div>
                {kind === 'payment' && balance <= 0 && <p className="flex items-center gap-2 text-sm text-amber-200 md:col-span-2"><AlertCircle className="h-4 w-4" />There is no outstanding balance for this student.</p>}
                <div className="md:col-span-2"><Button type="submit" disabled={saving || (kind === 'payment' && balance <= 0)} className="bg-cyan-400 text-slate-950 hover:bg-cyan-300">{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}{saving ? 'Saving…' : 'Save entry'}</Button></div>
              </form>
            </CardContent>
          </Card>
          <Card className="border-white/10 bg-[#0c1421]">
            <CardHeader><CardTitle className="text-white">Ledger history</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              {records.length ? <table className="w-full min-w-[560px] text-left text-sm"><thead className="text-slate-400"><tr><th className="p-3">Date</th><th className="p-3">Details</th><th className="p-3">Type</th><th className="p-3 text-right">Amount</th></tr></thead><tbody>{records.map((record) => <tr key={record.id} className="border-t border-white/10"><td className="p-3">{record.date}</td><td className="p-3">{record.description}</td><td className="p-3 capitalize">{record.kind}</td><td className={`p-3 text-right font-semibold ${record.kind === 'payment' ? 'text-emerald-300' : 'text-amber-200'}`}>{record.kind === 'payment' ? '−' : ''}{record.amount.toLocaleString()}</td></tr>)}</tbody></table> : <p className="py-8 text-center text-slate-400">No fee records yet.</p>}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
