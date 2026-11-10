'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Plus, Wallet } from 'lucide-react'
import { calculateFeeLedger, rtdb } from '@/lib/database'
import { useAuth } from '@/context/AuthContext'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ETHIOPIAN_MONTHS, ethiopianDateLabel, toEthiopianParts } from '@/lib/ethiopianDate'
import type { FeeRecord, Student } from '@/types'

const ETHIOPIAN_MONTH_NAMES = [
  'Meskerem', 'Tikimt', 'Hidar', 'Tahsas', 'Tir', 'Yekatit', 'Megabit',
  'Miazia', 'Ginbot', 'Sene', 'Hamle', 'Nehase', 'Pagume',
]
const FEE_CATEGORIES = [
  { value: 'MONTHLY_TUITION', label: 'Monthly tuition' },
  { value: 'REGISTRATION', label: 'Registration' },
  { value: 'BOOK_MATERIAL', label: 'Books / materials' },
  { value: 'EXAM_FEE', label: 'Exam fee' },
  { value: 'OTHER', label: 'Other' },
] as const
const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Cash' },
  { value: 'CBE', label: 'CBE' },
  { value: 'TELEBIRR', label: 'Telebirr' },
  { value: 'AWASH', label: 'Awash' },
  { value: 'ABYSSINIA', label: 'Abyssinia' },
] as const

export default function FeesPage() {
  const { user } = useAuth()
  const [students, setStudents] = useState<Student[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [records, setRecords] = useState<FeeRecord[]>([])
  const [kind, setKind] = useState<'charge' | 'payment' | 'waiver'>('charge')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [ethiopianYear, setEthiopianYear] = useState(() => {
    const parts = toEthiopianParts(new Date().toISOString().slice(0, 10))
    return parts ? String(parts.year) : ''
  })
  const [ethiopianMonth, setEthiopianMonth] = useState(() => {
    const parts = toEthiopianParts(new Date().toISOString().slice(0, 10))
    return parts ? String(parts.month) : ''
  })
  const [category, setCategory] = useState<FeeRecord['category']>('MONTHLY_TUITION')
  const [paymentMethod, setPaymentMethod] = useState<NonNullable<FeeRecord['paymentMethod']>>('CASH')
  const [receiptNumber, setReceiptNumber] = useState('')
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

  const ledger = useMemo(() => calculateFeeLedger(records), [records])
  const transactionEthiopianDate = ethiopianDateLabel(date)
  const statusTone = ledger.status === 'ADVANCE CREDIT'
    ? 'border-violet-300/30 bg-violet-300/10 text-violet-100'
    : ledger.status === 'CLEARED / PAID'
      ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-100'
      : ledger.status === 'PARTIAL'
        ? 'border-amber-300/30 bg-amber-300/10 text-amber-100'
        : 'border-rose-300/30 bg-rose-300/10 text-rose-100'

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    const value = Number(amount)
    if (!selectedId || !Number.isFinite(value) || value <= 0 || !description.trim()) {
      setError('Select a student and enter a valid amount and description.')
      return
    }
    const yearValue = Number(ethiopianYear)
    const monthValue = Number(ethiopianMonth)
    if (!Number.isInteger(yearValue) || yearValue < 1 || !Number.isInteger(monthValue) || monthValue < 1 || monthValue > 13) {
      setError('Select the Ethiopian fee month and year.')
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
        ethiopianYear: yearValue,
        ethiopianMonth: monthValue,
        category,
        ...(kind === 'payment' ? { paymentMethod, receiptNumber: receiptNumber.trim() || undefined } : {}),
        createdAt: new Date().toISOString(),
        createdBy: user?.uid || '',
        createdByName: user?.name || 'Admin',
      })
      setNotice(`${kind === 'charge' ? 'Fee charge' : kind === 'payment' ? 'Payment' : 'Waiver'} recorded.`)
      setAmount('')
      setDescription('')
      setReceiptNumber('')
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
          <div className="flex flex-wrap items-center gap-3">
            <span className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-semibold ${statusTone}`}>{ledger.status}</span>
            <span className="text-sm text-slate-400">Current balance: <strong className="text-slate-100">{ledger.balance.toLocaleString()}</strong></span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { title: 'Total charges', amount: ledger.totalCharges, tone: 'text-cyan-200' },
              { title: 'Paid', amount: ledger.totalPayments, tone: 'text-emerald-300' },
              { title: 'Waivers', amount: ledger.totalWaivers, tone: 'text-violet-200' },
              { title: ledger.balance < 0 ? 'Advance credit' : 'Balance due', amount: Math.abs(ledger.balance), tone: ledger.balance > 0 ? 'text-amber-200' : 'text-emerald-300' },
            ].map((item) => (
              <Card key={item.title} className="border-white/10 bg-[#0c1421]">
                <CardHeader className="pb-2"><CardDescription>{item.title}</CardDescription><CardTitle className={`text-2xl ${item.tone}`}>{item.amount.toLocaleString()}</CardTitle></CardHeader>
              </Card>
            ))}
          </div>
          <Card className="border-white/10 bg-[#0c1421]">
            <CardHeader><CardTitle className="flex items-center gap-2 text-white"><Wallet className="h-5 w-5 text-cyan-300" /> Add ledger entry</CardTitle><CardDescription>Record a fee charge, a payment (including advance credit), or a waiver/discount.</CardDescription></CardHeader>
            <CardContent>
              <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2"><Label htmlFor="fee-kind">Entry type</Label><select id="fee-kind" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className="h-10 w-full rounded-lg border border-white/10 bg-[#080f1b] px-3 text-sm"><option value="charge">Fee charge</option><option value="payment">Payment received</option><option value="waiver">Waiver / Discount</option></select></div>
                <div className="space-y-2"><Label htmlFor="fee-amount">Amount</Label><Input id="fee-amount" type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required /></div>
                <div className="space-y-2"><Label htmlFor="fee-description">Description</Label><Input id="fee-description" placeholder="e.g. Monthly tuition" value={description} onChange={(e) => setDescription(e.target.value)} required /></div>
                <div className="space-y-2"><Label htmlFor="fee-date">Transaction date (Gregorian)</Label><Input id="fee-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required /><p className="text-xs text-slate-400">Ethiopian date: {transactionEthiopianDate || 'Unavailable in this browser'}</p></div>
                <div className="space-y-2"><Label htmlFor="fee-ethiopian-month">Ethiopian fee month</Label><select id="fee-ethiopian-month" value={ethiopianMonth} onChange={(e) => setEthiopianMonth(e.target.value)} required className="h-10 w-full rounded-lg border border-white/10 bg-[#080f1b] px-3 text-sm"><option value="">Select month</option>{ETHIOPIAN_MONTHS.map((month, index) => <option key={month} value={index + 1}>{ETHIOPIAN_MONTH_NAMES[index]} · {month}</option>)}</select></div>
                <div className="space-y-2"><Label htmlFor="fee-ethiopian-year">Ethiopian fee year</Label><Input id="fee-ethiopian-year" type="number" min="1" step="1" value={ethiopianYear} onChange={(e) => setEthiopianYear(e.target.value)} placeholder="e.g. 2019" required /></div>
                <div className="space-y-2"><Label htmlFor="fee-category">Fee category</Label><select id="fee-category" value={category} onChange={(e) => setCategory(e.target.value as NonNullable<FeeRecord['category']>)} className="h-10 w-full rounded-lg border border-white/10 bg-[#080f1b] px-3 text-sm">{FEE_CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
                {kind === 'payment' && <>
                  <div className="space-y-2"><Label htmlFor="fee-payment-method">Payment method</Label><select id="fee-payment-method" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as NonNullable<FeeRecord['paymentMethod']>)} className="h-10 w-full rounded-lg border border-white/10 bg-[#080f1b] px-3 text-sm">{PAYMENT_METHODS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
                  <div className="space-y-2"><Label htmlFor="fee-receipt">Receipt / FT Number (optional)</Label><Input id="fee-receipt" value={receiptNumber} onChange={(e) => setReceiptNumber(e.target.value)} placeholder="Physical receipt or bank reference" /></div>
                </>}
                <div className="md:col-span-2"><Button type="submit" disabled={saving} className="bg-cyan-400 text-slate-950 hover:bg-cyan-300">{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}{saving ? 'Saving…' : 'Save entry'}</Button></div>
              </form>
            </CardContent>
          </Card>
          <Card className="border-white/10 bg-[#0c1421]">
            <CardHeader><CardTitle className="text-white">Ledger history</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              {ledger.entries.length ? <table className="w-full min-w-[980px] text-left text-sm"><thead className="text-slate-400"><tr><th className="p-3">Date (Gregorian)</th><th className="p-3">Date (Ethiopian)</th><th className="p-3">Fee period</th><th className="p-3">Details</th><th className="p-3">Type</th><th className="p-3">Payment info</th><th className="p-3 text-right">Amount</th><th className="p-3 text-right">Running Balance</th></tr></thead><tbody>{ledger.entries.map((record) => <tr key={record.id} className="border-t border-white/10"><td className="p-3">{record.date}</td><td className="p-3">{ethiopianDateLabel(record.date) || '—'}</td><td className="p-3">{record.ethiopianMonth && record.ethiopianYear ? `${ETHIOPIAN_MONTH_NAMES[record.ethiopianMonth - 1] || ''} ${record.ethiopianYear}` : '—'}</td><td className="p-3">{record.description}{record.category ? <span className="block text-xs text-slate-500">{FEE_CATEGORIES.find((item) => item.value === record.category)?.label || record.category}</span> : null}</td><td className="p-3 capitalize">{record.kind}</td><td className="p-3">{record.paymentMethod || record.receiptNumber ? `${record.paymentMethod || ''}${record.receiptNumber ? ` · ${record.receiptNumber}` : ''}` : '—'}</td><td className={`p-3 text-right font-semibold ${record.kind === 'charge' ? 'text-amber-200' : 'text-emerald-300'}`}>{record.kind === 'charge' ? '' : '−'}{record.amount.toLocaleString()}</td><td className={`p-3 text-right font-semibold ${record.runningBalance > 0 ? 'text-amber-200' : record.runningBalance < 0 ? 'text-violet-200' : 'text-emerald-300'}`}>{record.runningBalance.toLocaleString()}</td></tr>)}</tbody></table> : <p className="py-8 text-center text-slate-400">No fee records yet.</p>}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
