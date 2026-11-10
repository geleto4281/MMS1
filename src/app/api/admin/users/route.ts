import { NextResponse } from 'next/server'
import { getAdminApp } from '@/lib/firebase/admin'
import { getAuth } from 'firebase-admin/auth'
import { getDatabase } from 'firebase-admin/database'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/users
 *
 * Creates a new user using the Admin SDK so the client's
 * session is NOT hijacked (which happened with the browser's
 * `createUserWithEmailAndPassword`). Only an admin can do this.
 *
 * Auth: `Authorization: Bearer <idToken>` of an admin account.
 * Body: { name, email, password, phone?, role, assignedClassIds?, studentIds? }
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  const idToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : ''

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 })
  }
  const { name, email, password, phone, role, assignedClassIds, studentIds } = body || {}

  if (!email || !password || !name || typeof role !== 'string' || !['admin', 'teacher', 'parent'].includes(role)) {
    return NextResponse.json(
      { ok: false, error: 'name, email, password and role are required.' },
      { status: 400 }
    )
  }

  try {
    const admin = getAdminApp()
    const decoded = await getAuth(admin).verifyIdToken(idToken)
    const callerUid = decoded.uid

    const db = getDatabase(admin)
    const roleSnap = await db.ref('users/' + callerUid + '/role').get()
    if (roleSnap.val() !== 'admin') {
      return NextResponse.json(
        { ok: false, error: 'Admin privileges required.' },
        { status: 403 }
      )
    }

    const normalizedEmail = String(email).trim().toLowerCase()
    let linkedStudentIds: string[] = []
    if (role === 'parent') {
      const studentsSnap = await db.ref('students').get()
      if (studentIds !== undefined && !Array.isArray(studentIds)) {
        return NextResponse.json({ ok: false, error: 'studentIds must be an array.' }, { status: 400 })
      }
      if (Array.isArray(studentIds)) {
        const activeStudentIds = new Set<string>()
        studentsSnap.forEach((child) => {
          if (child.val()?.isActive !== false) activeStudentIds.add(child.key as string)
        })
        linkedStudentIds = [...new Set(studentIds.filter((id: unknown): id is string => typeof id === 'string' && id.length > 0))]
        if (linkedStudentIds.length === 0 || linkedStudentIds.some((id) => !activeStudentIds.has(id))) {
          return NextResponse.json({ ok: false, error: 'Choose at least one active student to link to this parent.' }, { status: 400 })
        }
      } else {
        studentsSnap.forEach((child) => {
          const student = child.val()
          if (
            student?.isActive !== false &&
            String(student?.parentEmail || '').trim().toLowerCase() === normalizedEmail
          ) {
            linkedStudentIds.push(child.key as string)
          }
        })
      }
      if (linkedStudentIds.length === 0) {
        return NextResponse.json(
          { ok: false, error: 'Choose at least one active student or add this email to a student before creating the parent account.' },
          { status: 400 }
        )
      }
    }

    // 1) Create the Firebase Auth account.
    const userRecord = await getAuth(admin).createUser({
      email: normalizedEmail,
      password,
      displayName: name,
    })
    const uid = userRecord.uid

    // 2) Write the profile (never write "undefined" or null to RTDB).
    const record: Record<string, any> = {
      uid,
      email: normalizedEmail,
      name,
      role,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: callerUid,
    }
    if (phone) record.phone = phone
    if (role === 'parent') record.linkedStudentIds = linkedStudentIds
    if (role === 'teacher' && Array.isArray(assignedClassIds) && assignedClassIds.length > 0) {
      record.assignedClassIds = assignedClassIds
    }
    const profileUpdates: Record<string, unknown> = { [`users/${uid}`]: record }
    linkedStudentIds.forEach((studentId) => {
      profileUpdates[`parentStudentLinks/${uid}/${studentId}`] = true
    })
    if (role === 'parent') {
      if (Array.isArray(studentIds)) {
        const [linksSnap, usersSnap] = await Promise.all([
          db.ref('parentStudentLinks').get(),
          db.ref('users').get(),
        ])
        const selected = new Set(linkedStudentIds)
        const parentIdsToUpdate = new Set<string>()
        linksSnap.forEach((parentChild) => {
          const oldParentId = parentChild.key as string
          if (oldParentId === uid) return
          parentChild.forEach((link) => {
            if (selected.has(link.key as string) && link.val() === true) {
              profileUpdates[`parentStudentLinks/${oldParentId}/${link.key}`] = null
              parentIdsToUpdate.add(oldParentId)
            }
          })
        })
        parentIdsToUpdate.forEach((oldParentId) => {
          const oldProfile = usersSnap.child(oldParentId).val()
          if (Array.isArray(oldProfile?.linkedStudentIds)) {
            profileUpdates[`users/${oldParentId}/linkedStudentIds`] = oldProfile.linkedStudentIds.filter(
              (studentId: string) => !selected.has(studentId)
            )
          }
        })
        linkedStudentIds.forEach((studentId) => {
          profileUpdates[`students/${studentId}/parentEmail`] = normalizedEmail
          profileUpdates[`students/${studentId}/parentName`] = name
          if (phone) profileUpdates[`students/${studentId}/parentPhone`] = phone
        })
      }
      const examsSnap = await db.ref('exams').get()
      examsSnap.forEach((examChild) => {
        const exam = examChild.val()
        if (exam?.status !== 'saved') return
        linkedStudentIds.forEach((studentId) => {
          const row = exam.rows?.[studentId]
          if (!row) return
          const examId = examChild.key as string
          profileUpdates[`studentExamResults/${studentId}/${examId}`] = {
            id: examId,
            classId: exam.classId || '',
            title: exam.title || '',
            type: exam.type || 'assignment',
            academicYear: exam.academicYear || '',
            updatedAt: exam.updatedAt || exam.createdAt || new Date().toISOString(),
            row,
          }
        })
      })
    }
    await db.ref().update(profileUpdates)

    // 3) Assign classes (teachers).
    if (role === 'teacher' && Array.isArray(assignedClassIds)) {
      const updates: Record<string, any> = {}
      for (const cid of assignedClassIds) {
        if (!cid) continue
        updates[`classes/${cid}/teacherId`] = uid
        updates[`classes/${cid}/teacherName`] = name
      }
      if (Object.keys(updates).length > 0) {
        await db.ref().update(updates)
      }
    }

    // 4) Audit log.
    await db
      .ref('audit/audit_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8))
      .set({
        actorId: callerUid,
        actorName: email,
        action: 'create',
        entity: 'user',
        entityId: uid,
        details: `${name} (${role})`,
        timestamp: new Date().toISOString(),
      })

    return NextResponse.json({ ok: true, uid })
  } catch (err: any) {
    console.error('Create user failed:', err)
    return NextResponse.json(
      { ok: false, error: err?.message || 'Failed to create user' },
      { status: 500 }
    )
  }
}