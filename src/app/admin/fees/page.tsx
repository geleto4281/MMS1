'use client'

import { LocalizedDashboardContent } from '@/components/LocalizedDashboardContent'
import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, CheckCircle2, Loader2, Plus, FileText, Wallet } from 'lucide-react'
import { calculateFeeLedger, rtdb } from '@/lib/database'
import { useAuth } from '@/context/AuthContext'
import { auth } from '@/lib/firebase/config'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ETHIOPIAN_MONTHS, ethiopianDateLabel, toEthiopianParts } from '@/lib/ethiopianDate'
import { FeeReceipt } from '@/components/FeeReceipt'
import type { Class, FeePaymentSubmission, FeeRecord, Student } from '@/types'

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
  const [classes, setClasses] = useState<Class[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [allRecords, setAllRecords] = useState<FeeRecord[]>([])
  const [submissions, setSubmissions] = useState<FeePaymentSubmission[]>([])
  const [schoolName, setSchoolName] = useState('')
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
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkMonth, setBulkMonth] = useState(() => {
    const parts = toEthiopianParts(new Date().toISOString().slice(0, 10))
    return parts ? String(parts.month) : ''
  })
  const [bulkYear, setBulkYear] = useState(() => {
    const parts = toEthiopianParts(new Date().toISOString().slice(0, 10))
    return parts ? String(parts.year) : ''
  })
  const [bulkGroup, setBulkGroup] = useState('all')
  const [bulkAmount, setBulkAmount] = useState('')
  const [bulkDescription, setBulkDescription] = useState('Monthly Tuition Fee')
  const [generating, setGenerating] = useState(false)
  const [bulkSummary, setBulkSummary] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [periodMonth, setPeriodMonth] = useState('')
  const [periodYear, setPeriodYear] = useState('')
  const [reviewingId, setReviewingId] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const refreshFeeData = async () => {
    const [feeRecords, paymentSubmissions] = await Promise.all([
      rtdb.getAllFeeRecords(),
      rtdb.getFeePaymentSubmissions(),
    ])
    setAllRecords(feeRecords)
    setSubmissions(paymentSubmissions)
  }

  useEffect(() => {
    Promise.all([
      rtdb.getAllStudents(),
      rtdb.getAllClasses(),
      rtdb.getAllFeeRecords(),
      rtdb.getFeePaymentSubmissions(),
      rtdb.getSettings(),
    ])
      .then(([list, classList, feeRecords, paymentSubmissions, settings]) => {
        const active = list.filter((student) => student.isActive !== false).sort((a, b) => a.name.localeCompare(b.name))
        setStudents(active)
        setClasses(classList.filter((item) => item.isActive !== false))
        setAllRecords(feeRecords)
        setSubmissions(paymentSubmissions)
        setSchoolName(settings.schoolName || '')
        setSelectedId(active[0]?.id || '')
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load fee records.'))
      .finally(() => setLoading(false))
  }, [])

  const records = useMemo(
    () => allRecords.filter((record) => record.studentId === selectedId),
    [allRecords, selectedId]
  )
  const selectedStudent = students.find((student) => student.id === selectedId)

  const ledger = useMemo(() => calculateFeeLedger(records), [records])
  const transactionEthiopianDate = ethiopianDateLabel(date)
  const statusTone = ledger.status === 'ADVANCE CREDIT'
    ? 'border-violet-300/30 bg-violet-300/10 text-violet-100'
    : ledger.status === 'CLEARED / PAID'
      ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-100'
      : ledger.status === 'PARTIAL'
        ? 'border-amber-300/30 bg-amber-300/10 text-amber-100'
        : 'border-rose-300/30 bg-rose-300/10 text-rose-100'

  const feeOverview = useMemo(() => students.map((student) => {
    const studentRecords = allRecords.filter((record) =>
      record.studentId === student.id
      && (!periodMonth || record.ethiopianMonth === Number(periodMonth))
      && (!periodYear || record.ethiopianYear === Number(periodYear))
    )
    const studentLedger = calculateFeeLedger(studentRecords)
    return {
      student,
      ledger: studentRecords.length === 0 && (periodMonth || periodYear)
        ? { ...studentLedger, status: 'UNPAID' as const }
        : studentLedger,
    }
  }), [students, allRecords, periodMonth, periodYear])
  const filteredOverview = feeOverview.filter(({ ledger }) => statusFilter === 'all' || ledger.status === statusFilter)
  const summary = feeOverview.reduce((totals, row) => ({
    charges: totals.charges + row.ledger.totalCharges,
    payments: totals.payments + row.ledger.totalPayments,
    waivers: totals.waivers + row.ledger.totalWaivers,
    outstanding: totals.outstanding + Math.max(0, row.ledger.balance),
  }), { charges: 0, payments: 0, waivers: 0, outstanding: 0 })
  const availableYears = [...new Set(allRecords.map((record) => record.ethiopianYear).filter((year): year is number => Boolean(year)))]
    .sort((a, b) => b - a)
  const availableGrades = [...new Set(classes.map((item) => item.grade).filter((grade): grade is string => Boolean(grade)))].sort()
  const pendingSubmissions = submissions.filter((submission) =>
    submission.status === 'pending' || submission.status === 'approving'
  )

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
      await refreshFeeData()
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

  const generateMonthlyFees = async (event: React.FormEvent) => {
    event.preventDefault()
    const amountValue = Number(bulkAmount)
    const yearValue = Number(bulkYear)
    const monthValue = Number(bulkMonth)
    if (!Number.isFinite(amountValue) || amountValue <= 0 || !bulkDescription.trim() ||
      !Number.isInteger(yearValue) || yearValue < 1 || !Number.isInteger(monthValue) || monthValue < 1 || monthValue > 13) {
      setError('Enter a valid amount, description, Ethiopian month, and year.')
      return
    }
    const targets = students.filter((student) => {
      if (bulkGroup === 'all') return true
      if (bulkGroup.startsWith('grade:')) {
        const grade = bulkGroup.slice('grade:'.length)
        return classes.some((item) => item.id === student.classId && item.grade === grade)
      }
      return student.classId === bulkGroup
    })
    if (!targets.length) {
      setError('There are no active students in the selected group.')
      return
    }

    setGenerating(true)
    setError('')
    setBulkSummary('')
    let created = 0
    let skipped = 0
    const failures: string[] = []
    const now = new Date().toISOString()
    try {
      for (const student of targets) {
        const alreadyBilled = allRecords.some((record) =>
          record.studentId === student.id
          && record.kind === 'charge'
          && record.ethiopianYear === yearValue
          && record.ethiopianMonth === monthValue
          && (!record.category || record.category === 'MONTHLY_TUITION')
        )
        if (alreadyBilled) {
          skipped++
          continue
        }
        try {
          const wasCreated = await rtdb.createMonthlyFeeCharge(student.id, {
            kind: 'charge',
            amount: amountValue,
            description: bulkDescription.trim(),
            date: now.slice(0, 10),
            ethiopianYear: yearValue,
            ethiopianMonth: monthValue,
            category: 'MONTHLY_TUITION',
            createdAt: now,
            createdBy: user?.uid || '',
            createdByName: user?.name || 'Admin',
          })
          if (wasCreated) created++
          else skipped++
        } catch (generationError) {
          failures.push(student.name)
          console.error(`Could not generate monthly fee for ${student.id}`, generationError)
        }
      }
      await refreshFeeData()
      const period = `${ETHIOPIAN_MONTH_NAMES[monthValue - 1]} ${yearValue}`
      setBulkSummary(`Created charges for ${created} students, skipped ${skipped} already billed${failures.length ? `, failed for ${failures.length}` : ''} (${period}).`)
      setBulkOpen(false)
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : 'Could not refresh fee records after generation.')
    } finally {
      setGenerating(false)
    }
  }

  const reviewPayment = async (submission: FeePaymentSubmission, action: 'approve' | 'reject') => {
    const reason = action === 'reject'
      ? window.prompt(`Why are you rejecting ${submission.parentName}'s payment notification?`)?.trim() || ''
      : ''
    if (action === 'reject' && !reason) return
    setReviewingId(submission.id)
    setError('')
    setNotice('')
    try {
      const idToken = await auth.currentUser?.getIdToken()
      if (!idToken) throw new Error('Your admin session has expired. Sign in again and retry.')
      const response = await fetch(`/api/admin/fees/submissions/${encodeURIComponent(submission.studentId)}/${encodeURIComponent(submission.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ action, ...(action === 'reject' ? { reason } : {}) }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Could not review this payment.')
      await refreshFeeData()
      setNotice(action === 'approve' ? 'Payment approved and added to the fee ledger.' : 'Payment notification rejected with your reason.')
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : 'Could not review this payment.')
    } finally {
      setReviewingId('')
    }
  }

  if (loading) return <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-cyan-300" /></div>

  return (
    <LocalizedDashboardContent>
    <div className="mms-dashboard space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-white">Fees & Payments</h1>
        <p className="mt-1 text-slate-400">Record student charges and payments; parents can view each child’s ledger.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" onClick={() => { setBulkSummary(''); setBulkOpen(true) }} className="bg-cyan-400 text-slate-950 hover:bg-cyan-300">
            <Plus className="mr-2 h-4 w-4" /> Generate Monthly Fees
          </Button>
          <Button type="button" variant="outline" onClick={() => document.getElementById('pending-payment-approvals')?.scrollIntoView({ behavior: 'smooth' })}>
            <FileText className="mr-2 h-4 w-4" /> Pending approvals ({pendingSubmissions.length})
          </Button>
        </div>
      </header>
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      {notice && <Alert variant="success"><AlertDescription>{notice}</AlertDescription></Alert>}
      {bulkSummary && <Alert variant="success"><AlertDescription>{bulkSummary}</AlertDescription></Alert>}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { title: 'Total expected / charged', amount: summary.charges, tone: 'text-cyan-200' },
          { title: 'Total collected', amount: summary.payments, tone: 'text-emerald-300' },
          { title: 'Total waived / discounted', amount: summary.waivers, tone: 'text-violet-200' },
          { title: 'Total outstanding', amount: summary.outstanding, tone: 'text-amber-200' },
        ].map((item) => (
          <Card key={item.title} className="border-white/10 bg-[#0c1421]">
            <CardHeader className="pb-2"><CardDescription>{item.title}</CardDescription><CardTitle className={`text-2xl ${item.tone}`}>{item.amount.toLocaleString()} ETB</CardTitle></CardHeader>
          </Card>
        ))}
      </section>
      <Card className="border-white/10 bg-[#0c1421]">
        <CardHeader>
          <CardTitle className="text-white">Student fee overview</CardTitle>
          <CardDescription>Choose an Ethiopian billing period to compare balances for that month, or leave it blank for the full ledger.</CardDescription>
          <div className="grid gap-3 pt-2 sm:grid-cols-3">
            <div className="space-y-2"><Label htmlFor="fee-overview-status">Account status</Label><select id="fee-overview-status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-10 w-full rounded-lg border border-white/10 bg-[#080f1b] px-3 text-sm text-slate-100"><option value="all">All statuses</option><option value="UNPAID">Unpaid</option><option value="PARTIAL">Partial</option><option value="CLEARED / PAID">Cleared / Paid</option><option value="ADVANCE CREDIT">Advance Credit</option></select></div>
            <div className="space-y-2"><Label htmlFor="fee-overview-month">Ethiopian month</Label><select id="fee-overview-month" value={periodMonth} onChange={(event) => setPeriodMonth(event.target.value)} className="h-10 w-full rounded-lg border border-white/10 bg-[#080f1b] px-3 text-sm text-slate-100"><option value="">All months</option>{ETHIOPIAN_MONTH_NAMES.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}</select></div>
            <div className="space-y-2"><Label htmlFor="fee-overview-year">Ethiopian year</Label><select id="fee-overview-year" value={periodYear} onChange={(event) => setPeriodYear(event.target.value)} className="h-10 w-full rounded-lg border border-white/10 bg-[#080f1b] px-3 text-sm text-slate-100"><option value="">All years</option>{availableYears.map((year) => <option key={year} value={year}>{year}</option>)}</select></div>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-slate-400"><tr><th className="p-3">Student</th><th className="p-3">Class</th><th className="p-3">Status</th><th className="p-3 text-right">Charged</th><th className="p-3 text-right">Paid</th><th className="p-3 text-right">Waived</th><th className="p-3 text-right">Outstanding / Credit</th></tr></thead>
            <tbody>{filteredOverview.map(({ student, ledger: studentLedger }) => {
              const statusClass = studentLedger.status === 'CLEARED / PAID' ? 'text-emerald-300' : studentLedger.status === 'ADVANCE CREDIT' ? 'text-violet-200' : studentLedger.status === 'PARTIAL' ? 'text-amber-200' : 'text-rose-200'
              return <tr key={student.id} className={`cursor-pointer border-t border-white/10 hover:bg-white/5 ${student.id === selectedId ? 'bg-white/5' : ''}`} onClick={() => setSelectedId(student.id)}>
                <td className="p-3 font-medium text-white">{student.name}</td>
                <td className="p-3">{classes.find((item) => item.id === student.classId)?.name || student.className || '—'}</td>
                <td className={`p-3 font-medium ${statusClass}`}>{studentLedger.status}</td>
                <td className="p-3 text-right">{studentLedger.totalCharges.toLocaleString()}</td>
                <td className="p-3 text-right">{studentLedger.totalPayments.toLocaleString()}</td>
                <td className="p-3 text-right">{studentLedger.totalWaivers.toLocaleString()}</td>
                <td className="p-3 text-right font-semibold">{studentLedger.balance < 0 ? `Credit ${Math.abs(studentLedger.balance).toLocaleString()}` : studentLedger.balance.toLocaleString()}</td>
              </tr>
            })}</tbody>
          </table>
          {!filteredOverview.length && <p className="py-6 text-center text-sm text-slate-400">No students match this filter.</p>}
        </CardContent>
      </Card>
      {bulkOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto bg-black/70 p-4">
          <Card className="my-auto w-full max-w-xl border-white/10 bg-[#0c1421]">
            <CardHeader><CardTitle className="text-white">Generate monthly fees</CardTitle><CardDescription>Students with an existing monthly tuition charge for the selected Ethiopian period will be skipped.</CardDescription></CardHeader>
            <CardContent>
              <form onSubmit={generateMonthlyFees} className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label htmlFor="bulk-fee-month">Ethiopian month</Label><select id="bulk-fee-month" value={bulkMonth} onChange={(event) => setBulkMonth(event.target.value)} required className="h-10 w-full rounded-lg border border-white/10 bg-[#080f1b] px-3 text-sm"><option value="">Select month</option>{ETHIOPIAN_MONTH_NAMES.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}</select></div>
                <div className="space-y-2"><Label htmlFor="bulk-fee-year">Ethiopian year</Label><Input id="bulk-fee-year" type="number" min="1" step="1" value={bulkYear} onChange={(event) => setBulkYear(event.target.value)} required /></div>
                <div className="space-y-2 sm:col-span-2"><Label htmlFor="bulk-fee-group">Target group</Label><select id="bulk-fee-group" value={bulkGroup} onChange={(event) => setBulkGroup(event.target.value)} className="h-10 w-full rounded-lg border border-white/10 bg-[#080f1b] px-3 text-sm"><option value="all">All active students ({students.length})</option>{availableGrades.map((grade) => <option key={`grade-${grade}`} value={`grade:${grade}`}>Grade {grade}</option>)}{classes.map((item) => <option key={item.id} value={item.id}>{item.name}{item.grade ? ` · Grade ${item.grade}` : ''}{item.section ? ` · ${item.section}` : ''}</option>)}</select></div>
                <div className="space-y-2"><Label htmlFor="bulk-fee-amount">Fee amount</Label><Input id="bulk-fee-amount" type="number" min="0.01" step="0.01" value={bulkAmount} onChange={(event) => setBulkAmount(event.target.value)} required /></div>
                <div className="space-y-2"><Label htmlFor="bulk-fee-description">Description</Label><Input id="bulk-fee-description" value={bulkDescription} onChange={(event) => setBulkDescription(event.target.value)} required /></div>
                <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="outline" disabled={generating} onClick={() => setBulkOpen(false)}>Cancel</Button><Button type="submit" disabled={generating} className="bg-cyan-400 text-slate-950 hover:bg-cyan-300">{generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}{generating ? 'Generating…' : 'Generate charges'}</Button></div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
      <Card id="pending-payment-approvals" className="scroll-mt-24 border-white/10 bg-[#0c1421]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white"><AlertCircle className="h-5 w-5 text-amber-300" /> Pending Payment Approvals ({pendingSubmissions.length})</CardTitle>
          <CardDescription>Parent notifications do not affect balances until you approve them. An interrupted approval can be resumed safely.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!pendingSubmissions.length ? <p className="py-4 text-sm text-slate-400">There are no pending parent payment notifications.</p> : pendingSubmissions.map((submission) => {
            const student = students.find((item) => item.id === submission.studentId)
            return <article key={submission.id} className="flex flex-col gap-3 rounded-xl border border-white/10 bg-[#080f1b] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-semibold text-white">{student?.name || 'Student'} · {submission.parentName}</p>
                <p className="mt-1 text-sm text-slate-300">{submission.amount.toLocaleString()} ETB · {PAYMENT_METHODS.find((item) => item.value === submission.paymentMethod)?.label || submission.paymentMethod} · {ETHIOPIAN_MONTH_NAMES[submission.ethiopianMonth - 1]} {submission.ethiopianYear}</p>
                <p className="mt-1 break-all text-xs text-slate-400">Reference: {submission.referenceNumber || '—'}{submission.note ? ` · ${submission.note}` : ''}</p>
                <p className="mt-1 text-xs text-slate-500">Submitted {new Date(submission.createdAt).toLocaleString()} · {submission.status}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button type="button" size="sm" disabled={reviewingId === submission.id} onClick={() => void reviewPayment(submission, 'approve')} className="bg-emerald-500 text-white hover:bg-emerald-600">
                  {reviewingId === submission.id ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-4 w-4" />}Approve
                </Button>
                <Button type="button" size="sm" variant="outline" disabled={reviewingId === submission.id || submission.status === 'approving'} onClick={() => void reviewPayment(submission, 'reject')}>Reject</Button>
              </div>
            </article>
          })}
        </CardContent>
      </Card>
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
              {ledger.entries.length ? <table className="w-full min-w-[1180px] text-left text-sm"><thead className="text-slate-400"><tr><th className="p-3">Date (Gregorian)</th><th className="p-3">Date (Ethiopian)</th><th className="p-3">Fee period</th><th className="p-3">Details</th><th className="p-3">Type</th><th className="p-3">Payment info</th><th className="p-3 text-right">Amount</th><th className="p-3 text-right">Running Balance</th><th className="p-3">Receipt</th></tr></thead><tbody>{ledger.entries.map((record) => <tr key={record.id} className="border-t border-white/10"><td className="p-3">{record.date}</td><td className="p-3">{ethiopianDateLabel(record.date) || '—'}</td><td className="p-3">{record.ethiopianMonth && record.ethiopianYear ? `${ETHIOPIAN_MONTH_NAMES[record.ethiopianMonth - 1] || ''} ${record.ethiopianYear}` : '—'}</td><td className="p-3">{record.description}{record.category ? <span className="block text-xs text-slate-500">{FEE_CATEGORIES.find((item) => item.value === record.category)?.label || record.category}</span> : null}</td><td className="p-3 capitalize">{record.kind}</td><td className="p-3">{record.paymentMethod || record.receiptNumber ? `${record.paymentMethod || ''}${record.receiptNumber ? ` · ${record.receiptNumber}` : ''}` : '—'}</td><td className={`p-3 text-right font-semibold ${record.kind === 'charge' ? 'text-amber-200' : 'text-emerald-300'}`}>{record.kind === 'charge' ? '' : '−'}{record.amount.toLocaleString()}</td><td className={`p-3 text-right font-semibold ${record.runningBalance > 0 ? 'text-amber-200' : record.runningBalance < 0 ? 'text-violet-200' : 'text-emerald-300'}`}>{record.runningBalance.toLocaleString()}</td><td className="p-3">{record.kind === 'payment' && selectedStudent ? <FeeReceipt record={record} student={selectedStudent} className={classes.find((item) => item.id === selectedStudent.classId)?.name || selectedStudent.className || ''} status={ledger.status} schoolName={schoolName} /> : '—'}</td></tr>)}</tbody></table> : <p className="py-8 text-center text-slate-400">No fee records yet.</p>}
            </CardContent>
          </Card>
        </>
      )}
    </div>
    </LocalizedDashboardContent>
  )
}
