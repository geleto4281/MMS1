'use client'

import { LocalizedDashboardContent } from '@/components/LocalizedDashboardContent'
import { useEffect, useState } from 'react'
import { CalendarDays, CheckCircle2, Loader2 } from 'lucide-react'
import { rtdb } from '@/lib/database'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { LeaveRequest, Student } from '@/types'

export default function AdminLeaveRequestsPage() {
  const [requests, setRequests] = useState<LeaveRequest[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([rtdb.getLeaveRequests(), rtdb.getAllStudents()])
      .then(([leaveRequests, allStudents]) => {
        setRequests(leaveRequests)
        setStudents(allStudents)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load leave notices.'))
      .finally(() => setLoading(false))
  }, [])

  const markReviewed = async (request: LeaveRequest) => {
    try {
      await rtdb.updateLeaveRequest(request.id, { status: 'reviewed' })
      setRequests((current) => current.map((item) => item.id === request.id ? { ...item, status: 'reviewed' } : item))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update this leave notice.')
    }
  }

  if (loading) return <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-cyan-300" /></div>

  return (
    <LocalizedDashboardContent>
    <div className="mms-dashboard space-y-6">
      <header><h1 className="text-3xl font-bold tracking-tight text-white">Parent Leave Notices</h1><p className="mt-1 text-slate-400">Review absence notices sent to the class Ustaz and administration.</p></header>
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      <Card className="border-white/10 bg-[#0c1421]">
        <CardHeader><CardTitle className="flex items-center gap-2 text-white"><CalendarDays className="h-5 w-5 text-cyan-300" />Leave requests</CardTitle><CardDescription>{requests.filter((request) => request.status === 'pending').length} awaiting review</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          {!requests.length ? <p className="py-8 text-center text-slate-400">No parent leave notices have been submitted.</p> : requests.map((request) => (
            <article key={request.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#080f1b] p-4">
              <div><h2 className="font-semibold text-white">{students.find((student) => student.id === request.studentId)?.name || 'Student'} · {request.date}</h2><p className="mt-1 text-sm text-slate-300">{request.reason}{request.note ? ` — ${request.note}` : ''}</p><p className="mt-1 text-xs text-slate-500">{request.parentName} · {new Date(request.createdAt).toLocaleString()}</p></div>
              {request.status === 'pending' ? <Button type="button" size="sm" variant="outline" onClick={() => void markReviewed(request)}>Mark reviewed</Button> : <span className="inline-flex items-center gap-1 text-xs text-emerald-200"><CheckCircle2 className="h-4 w-4" />Reviewed</span>}
            </article>
          ))}
        </CardContent>
      </Card>
    </div>
    </LocalizedDashboardContent>
  )
}
