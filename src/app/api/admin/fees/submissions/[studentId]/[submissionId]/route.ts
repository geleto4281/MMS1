import { NextResponse } from 'next/server'
import { getAdminApp } from '@/lib/firebase/admin'
import { getAuth } from 'firebase-admin/auth'
import { getDatabase } from 'firebase-admin/database'
import type { FeePaymentSubmission, FeeRecord } from '@/types'

export const dynamic = 'force-dynamic'

const PAYMENT_METHODS = ['CASH', 'CBE', 'TELEBIRR', 'AWASH', 'ABYSSINIA']

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ studentId: string; submissionId: string }> }
) {
  const { studentId, submissionId } = await params
  try {
    const authHeader = request.headers.get('authorization')
    const idToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : ''
    const adminApp = getAdminApp()
    const decoded = await getAuth(adminApp).verifyIdToken(idToken)
    const db = getDatabase(adminApp)
    const roleSnapshot = await db.ref(`users/${decoded.uid}/role`).get()
    if (roleSnapshot.val() !== 'admin') {
      return NextResponse.json({ ok: false, error: 'Admin privileges required.' }, { status: 403 })
    }

    let body: { action?: unknown; reason?: unknown }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 })
    }
    const submissionRef = db.ref(`feePaymentSubmissions/${studentId}/${submissionId}`)
    const snapshot = await submissionRef.get()
    if (!snapshot.exists()) {
      return NextResponse.json({ ok: false, error: 'Payment submission not found.' }, { status: 404 })
    }
    const submission = snapshot.val() as FeePaymentSubmission
    const reviewerSnapshot = await db.ref(`users/${decoded.uid}/name`).get()
    const reviewerName = String(reviewerSnapshot.val() || 'Administrator')
    const now = new Date().toISOString()

    if (body.action === 'reject') {
      const reason = typeof body.reason === 'string' ? body.reason.trim() : ''
      if (!reason) {
        return NextResponse.json({ ok: false, error: 'Enter a reason for rejecting this payment.' }, { status: 400 })
      }
      const result = await submissionRef.transaction((current: FeePaymentSubmission | null) => {
        if (!current || current.status !== 'pending') return
        return {
          ...current,
          status: 'rejected',
          reviewedAt: now,
          reviewedBy: reviewerName,
          rejectionReason: reason,
        }
      })
      if (!result.committed) {
        return NextResponse.json({ ok: false, error: 'This submission is no longer pending review.' }, { status: 409 })
      }
      await db.ref(`audit/audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`).set({
        actorId: decoded.uid,
        actorName: reviewerName,
        action: 'reject',
        entity: 'feePaymentSubmission',
        entityId: submissionId,
        details: `${submission.parentName} · ${reason}`,
        timestamp: now,
      })
      return NextResponse.json({ ok: true })
    }

    if (body.action !== 'approve') {
      return NextResponse.json({ ok: false, error: 'Choose approve or reject.' }, { status: 400 })
    }
    if (!Number.isFinite(submission.amount) || submission.amount <= 0 ||
      !Number.isInteger(submission.ethiopianYear) || !Number.isInteger(submission.ethiopianMonth) ||
      submission.ethiopianMonth < 1 || submission.ethiopianMonth > 13 ||
      !PAYMENT_METHODS.includes(submission.paymentMethod)) {
      return NextResponse.json({ ok: false, error: 'The submitted payment details are invalid.' }, { status: 400 })
    }

    if (submission.status === 'pending') {
      const lockResult = await submissionRef.transaction((current: FeePaymentSubmission | null) => {
        if (!current || current.status !== 'pending') return
        return { ...current, status: 'approving', reviewedAt: now, reviewedBy: reviewerName }
      })
      if (!lockResult.committed) {
        const latest = (await submissionRef.get()).val() as FeePaymentSubmission | null
        if (!latest || !['approving', 'approved'].includes(latest.status)) {
          return NextResponse.json({ ok: false, error: 'This submission is no longer pending review.' }, { status: 409 })
        }
      }
    } else if (submission.status !== 'approving' && submission.status !== 'approved') {
      return NextResponse.json({ ok: false, error: 'This submission is no longer pending review.' }, { status: 409 })
    }

    const feeId = `fee_submission_${submissionId}`
    const payment: FeeRecord = {
      id: feeId,
      studentId,
      kind: 'payment',
      amount: submission.amount,
      description: submission.note
        ? `Parent payment approved — ${submission.note}`
        : 'Parent payment approved',
      date: submission.createdAt.slice(0, 10),
      createdAt: now,
      createdBy: decoded.uid,
      createdByName: reviewerName,
      ethiopianYear: submission.ethiopianYear,
      ethiopianMonth: submission.ethiopianMonth,
      paymentMethod: submission.paymentMethod,
      receiptNumber: submission.referenceNumber || submission.id,
      sourceSubmissionId: submissionId,
    }
    const feeRef = db.ref(`fees/${studentId}/${feeId}`)
    const feeResult = await feeRef.transaction((current: FeeRecord | null) => {
      if (current === null) return payment
      return current.sourceSubmissionId === submissionId ? current : undefined
    })
    if (!feeResult.committed && feeResult.snapshot.val()?.sourceSubmissionId !== submissionId) {
      return NextResponse.json({ ok: false, error: 'Could not add the approved payment to the ledger.' }, { status: 409 })
    }
    await submissionRef.update({
      status: 'approved',
      reviewedAt: now,
      reviewedBy: reviewerName,
      approvedFeeId: feeId,
    })
    await db.ref(`audit/audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`).set({
      actorId: decoded.uid,
      actorName: reviewerName,
      action: 'approve',
      entity: 'feePaymentSubmission',
      entityId: submissionId,
      details: `${submission.parentName} · ${submission.amount}`,
      timestamp: now,
    })
    return NextResponse.json({ ok: true, feeId })
  } catch (error) {
    console.error('Review parent payment failed:', error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Could not review this payment.' },
      { status: 500 }
    )
  }
}
