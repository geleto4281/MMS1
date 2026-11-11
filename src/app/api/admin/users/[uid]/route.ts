import { NextResponse } from 'next/server'
import { getAdminApp } from '@/lib/firebase/admin'
import { getAuth } from 'firebase-admin/auth'
import { getDatabase } from 'firebase-admin/database'

export const dynamic = 'force-dynamic'

async function verifyAdmin(request: Request) {
  const authHeader = request.headers.get('authorization')
  const idToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : ''
  const admin = getAdminApp()
  const decoded = await getAuth(admin).verifyIdToken(idToken)
  const db = getDatabase(admin)
  const roleSnap = await db.ref('users/' + decoded.uid + '/role').get()
  if (roleSnap.val() !== 'admin') {
    throw new Error('Admin privileges required.')
  }
  return { admin, db, callerUid: decoded.uid }
}

/**
 * PATCH /api/admin/users/[uid]
 *
 * Updates a user profile, teacher class assignments, or parent-student links.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ uid: string }> }
) {
  const { uid } = await params
  try {
    const { db, callerUid } = await verifyAdmin(request)
    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 })
    }
    const hasParentStudentIds = Array.isArray(body?.studentIds)
    const hasAssignedClassIds = Array.isArray(body?.assignedClassIds)
    const assignedClassIds = hasAssignedClassIds
      ? [...new Set((body.assignedClassIds as unknown[]).filter((id): id is string => typeof id === 'string' && id.length > 0))]
      : null
    const profile = body.profile && typeof body.profile === 'object'
      ? body.profile as Record<string, unknown>
      : null

    if (!assignedClassIds && !hasParentStudentIds && !profile) {
      return NextResponse.json({ ok: false, error: 'Provide profile data, assignedClassIds, or studentIds.' }, { status: 400 })
    }

    const [userSnap, classesSnap, usersSnap] = await Promise.all([
      db.ref('users/' + uid).get(),
      db.ref('classes').get(),
      db.ref('users').get(),
    ])
    const user = userSnap.val()
    if (!user) {
      return NextResponse.json({ ok: false, error: 'User not found.' }, { status: 404 })
    }
    if (user.role === 'parent' && hasParentStudentIds) {
      const selectedStudentIds: string[] = [...new Set<string>(
        (body.studentIds as unknown[]).filter((id): id is string => typeof id === 'string' && id.length > 0)
      )]
      if (selectedStudentIds.length === 0) {
        return NextResponse.json({ ok: false, error: 'Choose at least one active student to link.' }, { status: 400 })
      }

      const [studentsSnap, linksSnap] = await Promise.all([
        db.ref('students').get(),
        db.ref('parentStudentLinks').get(),
      ])
      const activeStudentIds = new Set<string>()
      studentsSnap.forEach((child) => {
        if (child.val()?.isActive !== false) activeStudentIds.add(child.key as string)
      })
      if (selectedStudentIds.some((studentId) => !activeStudentIds.has(studentId))) {
        return NextResponse.json({ ok: false, error: 'One or more selected students are no longer active.' }, { status: 400 })
      }

      const selected = new Set(selectedStudentIds)
      const updates: Record<string, unknown> = {}
      const currentLinkedIds = new Set<string>()
      linksSnap.child(uid).forEach((link) => {
        if (link.val() === true) currentLinkedIds.add(link.key as string)
      })
      const parentIdsToUpdate = new Set<string>()

      linksSnap.forEach((parentChild) => {
        const oldParentId = parentChild.key as string
        if (oldParentId === uid) return
        parentChild.forEach((link) => {
          if (selected.has(link.key as string) && link.val() === true) {
            updates[`parentStudentLinks/${oldParentId}/${link.key}`] = null
            parentIdsToUpdate.add(oldParentId)
          }
        })
      })
      selectedStudentIds.forEach((studentId) => {
        currentLinkedIds.add(studentId)
        updates[`parentStudentLinks/${uid}/${studentId}`] = true
        updates[`students/${studentId}/parentEmail`] = user.email
        updates[`students/${studentId}/parentName`] = user.name
        if (user.phone) updates[`students/${studentId}/parentPhone`] = user.phone
      })
      updates[`users/${uid}/linkedStudentIds`] = [...currentLinkedIds]
      updates[`users/${uid}/updatedAt`] = new Date().toISOString()

      parentIdsToUpdate.forEach((oldParentId) => {
        const oldProfile = usersSnap.child(oldParentId).val()
        if (Array.isArray(oldProfile?.linkedStudentIds)) {
          updates[`users/${oldParentId}/linkedStudentIds`] = oldProfile.linkedStudentIds.filter(
            (studentId: string) => !selected.has(studentId)
          )
        }
      })

      const examsSnap = await db.ref('exams').get()
      examsSnap.forEach((examChild) => {
        const exam = examChild.val()
        if (exam?.status !== 'saved') return
        selectedStudentIds.forEach((studentId) => {
          const row = exam.rows?.[studentId]
          if (!row) return
          const examId = examChild.key as string
          updates[`studentExamResults/${studentId}/${examId}`] = {
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

      await db.ref().update(updates)
      await db.ref('audit/audit_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)).set({
        actorId: callerUid,
        action: 'update',
        entity: 'user',
        entityId: uid,
        details: `Linked ${selectedStudentIds.length} student(s) to parent ${user.name}`,
        timestamp: new Date().toISOString(),
      })
      return NextResponse.json({ ok: true })
    }

    if (hasParentStudentIds) {
      return NextResponse.json({ ok: false, error: 'Only parent accounts can be linked to students.' }, { status: 400 })
    }

    const nextRole = profile?.role === undefined ? user.role : profile.role
    if (user.role === 'parent' ? nextRole !== 'parent' : !['admin', 'teacher'].includes(String(nextRole))) {
      return NextResponse.json({ ok: false, error: 'Parent accounts must be managed in Parents; staff roles must be admin or teacher.' }, { status: 400 })
    }
    if (assignedClassIds && nextRole !== 'teacher') {
      return NextResponse.json({ ok: false, error: 'Only teacher accounts can be assigned to classes.' }, { status: 400 })
    }

    const nextName = profile?.name === undefined ? user.name : String(profile.name).trim()
    const nextEmail = profile?.email === undefined ? user.email : String(profile.email).trim().toLowerCase()
    const nextPhone = profile?.phone === undefined ? (user.phone || '') : String(profile.phone).trim()
    if (!nextName || !nextEmail || !nextEmail.includes('@')) {
      return NextResponse.json({ ok: false, error: 'Enter a valid name and email address.' }, { status: 400 })
    }

    if (user.role === 'admin' && nextRole !== 'admin') {
      let activeAdminCount = 0
      usersSnap.forEach((child) => {
        if (child.val()?.role === 'admin' && child.val()?.status !== 'inactive') activeAdminCount++
      })
      if (activeAdminCount <= 1) {
        return NextResponse.json({ ok: false, error: 'The last active admin cannot be changed to a teacher.' }, { status: 400 })
      }
    }

    const now = new Date().toISOString()
    const updates: Record<string, unknown> = {
      [`users/${uid}/name`]: nextName,
      [`users/${uid}/email`]: nextEmail,
      [`users/${uid}/phone`]: nextPhone || null,
      [`users/${uid}/role`]: nextRole,
      [`users/${uid}/updatedAt`]: now,
    }

    const authUpdates: { displayName: string; email?: string } = { displayName: nextName }
    if (nextEmail !== user.email) authUpdates.email = nextEmail
    await getAuth(getAdminApp()).updateUser(uid, authUpdates)

    if (profile?.role !== undefined && nextRole !== user.role) {
      if (nextRole === 'admin') {
        updates[`users/${uid}/assignedClassIds`] = null
      } else {
        updates[`users/${uid}/assignedClassIds`] = assignedClassIds || null
      }
    }

    if (user.role === 'parent') {
      const linksSnap = await db.ref(`parentStudentLinks/${uid}`).get()
      linksSnap.forEach((link) => {
        if (link.val() !== true) return
        const studentId = link.key as string
        updates[`students/${studentId}/parentName`] = nextName
        updates[`students/${studentId}/parentEmail`] = nextEmail
        updates[`students/${studentId}/parentPhone`] = nextPhone || null
      })
    }

    if (assignedClassIds || user.role === 'teacher' || nextRole === 'teacher') {
      const selected = new Set(assignedClassIds || [])
      const assignedByUser = new Map<string, string[]>()
      usersSnap.forEach((child) => {
        const value = child.val()
        if (value?.role === 'teacher' && Array.isArray(value.assignedClassIds)) {
          assignedByUser.set(child.key as string, value.assignedClassIds)
        }
      })

      classesSnap.forEach((child) => {
        const classId = child.key as string
        const value = child.val()
        if (!value) return

        if (nextRole === 'teacher' && assignedClassIds && selected.has(classId)) {
          updates[`classes/${classId}/teacherId`] = uid
          updates[`classes/${classId}/teacherName`] = nextName
        } else if (value.teacherId === uid) {
          if (nextRole === 'teacher' && !assignedClassIds) {
            updates[`classes/${classId}/teacherName`] = nextName
          } else {
            updates[`classes/${classId}/teacherId`] = null
            updates[`classes/${classId}/teacherName`] = null
          }
        }

        if (nextRole === 'teacher' && assignedClassIds && selected.has(classId)) {
          assignedByUser.forEach((ids, otherUid) => {
            if (otherUid !== uid && ids.includes(classId)) {
              updates[`users/${otherUid}/assignedClassIds`] = ids.filter((id) => id !== classId)
              updates[`users/${otherUid}/updatedAt`] = now
            }
          })
        }
      })

      if (assignedClassIds) {
        updates[`users/${uid}/assignedClassIds`] = assignedClassIds
      }
    }

    await db.ref().update(updates)
    await db.ref('audit/audit_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)).set({
      actorId: callerUid,
      action: 'update',
      entity: 'user',
      entityId: uid,
      details: `Updated ${user.name}: ${user.role} → ${nextRole}`,
      timestamp: now,
    })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('Update user failed:', err)
    return NextResponse.json(
      { ok: false, error: err?.message || 'Failed to update user assignments' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/users/[uid]
 *
 * Permanently deletes a user (from Firebase Auth + Realtime Database) and
 * unassigns any classes they taught. Only an admin can do this, and an admin
 * cannot delete their own account (to avoid locking everyone out).
 *
 * Auth: the caller must send `Authorization: Bearer <idToken>` where the token
 * belongs to an account whose `users/{uid}/role` is "admin".
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ uid: string }> }
) {
  const { uid } = await params
  const authHeader = request.headers.get('authorization')
  const idToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : ''

  try {
    const admin = getAdminApp()

    // Verify the caller and confirm they are an admin.
    const decoded = await getAuth(admin).verifyIdToken(idToken)
    const callerUid = decoded.uid

    if (callerUid === uid) {
      return NextResponse.json(
        { ok: false, error: 'You cannot delete your own account.' },
        { status: 400 }
      )
    }

    const db = getDatabase(admin)
    const roleSnap = await db.ref('users/' + callerUid + '/role').get()
    if (roleSnap.val() !== 'admin') {
      return NextResponse.json(
        { ok: false, error: 'Admin privileges required.' },
        { status: 403 }
      )
    }

    // Unassign classes taught by the user being deleted.
    const classesSnap = await db.ref('classes').get()
    const classUpdates: Record<string, null> = {}
    classesSnap.forEach((child) => {
      const val = child.val()
      if (val && val.teacherId === uid) {
        classUpdates[`classes/${child.key}/teacherId`] = null
        classUpdates[`classes/${child.key}/teacherName`] = null
      }
    })
    if (Object.keys(classUpdates).length > 0) {
      await db.ref().update(classUpdates)
    }

    // Remove the Auth account and the RTDB profile.
    await getAuth(admin).deleteUser(uid)
    await db.ref('users/' + uid).remove()
    await db.ref('parentStudentLinks/' + uid).remove()

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('Delete user failed:', err)
    return NextResponse.json(
      { ok: false, error: err?.message || 'Failed to delete user' },
      { status: 500 }
    )
  }
}