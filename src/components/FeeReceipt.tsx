'use client'

import { useState } from 'react'
import { Printer, FileText, X } from 'lucide-react'
import type { FeeLedgerEntry, FeeLedgerStatus } from '@/lib/database'
import type { Student } from '@/types'
import { Button } from '@/components/ui/button'

const ETHIOPIAN_MONTHS = [
  'Meskerem', 'Tikimt', 'Hidar', 'Tahsas', 'Tir', 'Yekatit', 'Megabit',
  'Miazia', 'Ginbot', 'Sene', 'Hamle', 'Nehase', 'Pagume',
]

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: 'Cash',
  CBE: 'CBE',
  TELEBIRR: 'Telebirr',
  AWASH: 'Awash',
  ABYSSINIA: 'Bank of Abyssinia',
}

type FeeReceiptProps = {
  record: FeeLedgerEntry
  student: Student
  className: string
  status: FeeLedgerStatus
  schoolName?: string
}

export function FeeReceipt({ record, student, className, status, schoolName }: FeeReceiptProps) {
  const [open, setOpen] = useState(false)
  if (record.kind !== 'payment') return null

  const billingPeriod = record.ethiopianMonth && record.ethiopianYear
    ? `${ETHIOPIAN_MONTHS[record.ethiopianMonth - 1] || 'Month'} ${record.ethiopianYear}`
    : 'Not specified'
  const receiptNumber = record.id

  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        <FileText className="mr-1.5 h-4 w-4" /> View / Print Receipt
      </Button>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/70 p-4">
          <div className="fee-receipt-print relative my-auto w-full max-w-xl rounded-2xl bg-white p-6 text-slate-900 shadow-2xl sm:p-9">
            <div className="fee-receipt-screen-controls absolute right-4 top-4 flex gap-2">
              <Button type="button" size="sm" onClick={() => window.print()}>
                <Printer className="mr-2 h-4 w-4" /> Print
              </Button>
              <Button type="button" size="icon" variant="outline" aria-label="Close receipt" onClick={() => setOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <header className="border-b-2 border-emerald-700 pb-5 pr-16">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Official payment receipt</p>
              <h2 className="mt-2 text-2xl font-bold">{schoolName?.trim() || 'Madrasah Management System'}</h2>
              <p className="mt-1 text-sm text-slate-500">Receipt No. <span className="font-semibold text-slate-800">{receiptNumber}</span></p>
            </header>
            <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <div><dt className="text-slate-500">Student</dt><dd className="mt-1 font-semibold">{student.name}</dd></div>
              <div><dt className="text-slate-500">Class</dt><dd className="mt-1 font-semibold">{className || 'Not assigned'}</dd></div>
              <div><dt className="text-slate-500">Payment date</dt><dd className="mt-1 font-semibold">{record.date}</dd></div>
              <div><dt className="text-slate-500">Ethiopian billing period</dt><dd className="mt-1 font-semibold">{billingPeriod}</dd></div>
              <div><dt className="text-slate-500">Payment method</dt><dd className="mt-1 font-semibold">{PAYMENT_METHOD_LABELS[record.paymentMethod || ''] || record.paymentMethod || 'Not specified'}</dd></div>
              <div><dt className="text-slate-500">Bank / transaction reference</dt><dd className="mt-1 break-all font-semibold">{record.receiptNumber || '—'}</dd></div>
            </dl>
            <div className="mt-7 rounded-xl bg-emerald-50 p-5">
              <p className="text-sm text-emerald-800">Amount paid</p>
              <p className="mt-1 text-3xl font-bold text-emerald-900">{record.amount.toLocaleString()} ETB</p>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-4 border-b border-slate-200 pb-5 text-sm">
              <div><p className="text-slate-500">Balance after this payment</p><p className="mt-1 font-semibold">{record.runningBalance.toLocaleString()} ETB</p></div>
              <div><p className="text-slate-500">Current account status</p><p className="mt-1 font-semibold">{status}</p></div>
            </div>
            <p className="mt-6 text-center text-xs text-slate-500">Thank you. Keep this receipt for your records.</p>
          </div>
          <style jsx global>{`
            @media print {
              body * { visibility: hidden !important; }
              .fee-receipt-print, .fee-receipt-print * { visibility: visible !important; }
              .fee-receipt-print {
                position: fixed !important;
                inset: 0 !important;
                width: 100% !important;
                max-width: none !important;
                margin: 0 !important;
                padding: 28px !important;
                border-radius: 0 !important;
                box-shadow: none !important;
                color: #0f172a !important;
                background: #fff !important;
              }
              .fee-receipt-screen-controls { display: none !important; }
              @page { margin: 12mm; }
            }
          `}</style>
        </div>
      )}
    </>
  )
}
