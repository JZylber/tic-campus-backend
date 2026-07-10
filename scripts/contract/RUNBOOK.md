# Contract migration — runbook & record

Final step of the `Subject → Subject(abstract) + Offering + OfferingCourse + StudentOffering`
refactor. This dropped the legacy tables and locked in constraints. **Executed 2026-07-10.**

## Order of operations (as executed)

1. **Backup** — `pg_dump` to scratchpad (`backup-pre-contract-*.sql`), the rollback floor.
2. **Dedup** — `DRY_RUN=false pnpm dlx tsx scripts/contract/01-dedup.ts`
   - Merged duplicate courses: NR4C `{12,27}`→12, NR4E `{13,29}`→13 (kept lowest id).
   - Repointed 32 + 27 `StudentCourse` rows onto the winners; deleted courses 27, 29.
   - Result: `Course` 35→33. **Corrective side effect:** the 59 students were on the
     roster-only sibling course (no offering); merging united them with the Bases de Datos
     offering, so their subjects / marks roster / `enrollment` now include it
     (`enrollment` view 882 → 941).
3. **Constraints push** — `prisma db push --accept-data-loss` (flag only because adding a
   unique index is flagged as "possible loss"; nothing was lost):
   - `Course @@unique([name,year])`, `StudentCourse @@unique([studentId,courseId])`.
   - `StudentOffering` composite FKs: `(studentId,courseId)→StudentCourse`,
     `(offeringId,courseId)→OfferingCourse` (integrity for OPTIONAL enrollments).
4. **Drop-legacy push** — `prisma db push --accept-data-loss`:
   - Dropped `Subject` (38), `TeacherSubject` (6), `RevisionRequest.subjectId` (240 values).
   - Made `RevisionRequest.offeringId` / `courseId` NOT NULL (all 240 populated).
5. **Rename** — `scripts/contract/rename-abstractsubject.sql`
   (`ALTER TABLE "AbstractSubject" RENAME TO "Subject"`), then renamed the Prisma model
   `AbstractSubject → Subject` and `prisma db push` (no-op diff). Controllers were unaffected
   (they use the `subject` relation field, not the model accessor).
6. **Enrollment view** — survived all pushes (Prisma does not manage it). If a FUTURE
   `db push` ever drops it, re-apply `scripts/enrollment-view.sql`.
7. **Build/verify** — excluded `scripts/` from `tsconfig` (one-off ops scripts run via tsx,
   not part of the server build); `tsc` clean; re-captured golden JSON and diffed vs the
   pre-refactor baseline → **only** `courses.json` (35→33) and 59 `students.json` records
   changed (both intended), everything else byte-identical.

## Final schema
Tables: `User, Course, Subject, Offering, OfferingCourse, TeacherOffering, StudentOffering,
StudentCourse, RevisionRequest` + `enrollment` view. `OfferingCourse.legacySubjectId` is kept
permanently as the stable external id (feeds `id_subject` / `getTemplateSubjects.id`).

## Rollback
Restore `backup-pre-contract-*.sql` into a fresh database and repoint `DATABASE_URL`. Because
the pre-contract DB still had the legacy tables, restoring it also restores the pre-refactor
code's data path.

## Still pending (not part of the DB contract)
- **Deploy** the cutover backend code (currently built & verified locally, not deployed).
- **New-capability endpoints** for creating OPTIONAL offerings / enrolling student subsets —
  intentionally left out; structure undecided.
