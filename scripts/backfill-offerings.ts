/**
 * One-off idempotent backfill for the Subject -> Offering refactor.
 *
 *   AbstractSubject  (one per distinct legacy Subject.name)
 *   Offering         (one per legacy Subject row, kind=MANDATORY)
 *   OfferingCourse   (offering -> its single legacy course; carries legacySubjectId)
 *   TeacherOffering  (from TeacherSubject)
 *   RevisionRequest  (offeringId + courseId backfilled from legacySubjectId map)
 *
 * StudentOffering is intentionally NOT populated (MANDATORY membership is derived).
 * Re-runnable: every step guards on already-present rows. Fails loud on any
 * validation mismatch (process exit 1).
 *
 * Run:  DATABASE_URL=... pnpm dlx tsx scripts/backfill-offerings.ts
 */
import "../loadEnv.ts";
import prisma from "../prisma/prisma.ts";

let FAIL = false;
function check(label: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? "  — " + detail : ""}`);
  if (!ok) FAIL = true;
}

async function main() {
  const legacy = await prisma.subject.findMany({
    orderBy: { id: "asc" },
    select: {
      id: true,
      name: true,
      spreadsheetId: true,
      templateId: true,
      marks: true,
      courseId: true,
      course: { select: { name: true, year: true } },
    },
  });

  // 1) AbstractSubject — one per distinct name; marks = OR across that name's rows.
  const byName = new Map<string, { marks: boolean; markSet: Set<boolean> }>();
  for (const s of legacy) {
    const e = byName.get(s.name) ?? { marks: false, markSet: new Set<boolean>() };
    e.marks = e.marks || s.marks;
    e.markSet.add(s.marks);
    byName.set(s.name, e);
  }
  for (const [name, e] of byName) {
    if (e.markSet.size > 1)
      console.warn(`WARN  marks not uniform across offerings of "${name}" — collapsed to ${e.marks}`);
    await prisma.abstractSubject.upsert({
      where: { name },
      create: { name, marks: e.marks },
      update: { marks: e.marks },
    });
  }
  const abstractByName = new Map(
    (await prisma.abstractSubject.findMany({ select: { id: true, name: true } })).map(
      (a) => [a.name, a.id],
    ),
  );

  // 2 + 3) Offering + OfferingCourse per legacy row (guarded by legacySubjectId).
  for (const s of legacy) {
    const existing = await prisma.offeringCourse.findUnique({
      where: { legacySubjectId: s.id },
      select: { id: true },
    });
    if (existing) continue;
    await prisma.$transaction(async (tx) => {
      const offering = await tx.offering.create({
        data: {
          subjectId: abstractByName.get(s.name)!,
          templateId: s.templateId,
          spreadsheetId: s.spreadsheetId,
          kind: "MANDATORY",
          year: s.course.year,
        },
        select: { id: true },
      });
      await tx.offeringCourse.create({
        data: {
          offeringId: offering.id,
          courseId: s.courseId,
          legacySubjectId: s.id,
        },
      });
    });
  }

  // legacySubjectId -> { offeringId, courseId }
  const ocRows = await prisma.offeringCourse.findMany({
    where: { legacySubjectId: { not: null } },
    select: { offeringId: true, courseId: true, legacySubjectId: true },
  });
  const mapByLegacy = new Map(
    ocRows.map((r) => [r.legacySubjectId as number, { offeringId: r.offeringId, courseId: r.courseId }]),
  );

  // 4) TeacherOffering from TeacherSubject.
  const teacherSubjects = await prisma.teacherSubject.findMany({
    select: { teacherId: true, subjectId: true },
  });
  for (const ts of teacherSubjects) {
    const m = mapByLegacy.get(ts.subjectId);
    if (!m) {
      console.warn(`WARN  TeacherSubject subjectId=${ts.subjectId} has no offering mapping`);
      continue;
    }
    await prisma.teacherOffering.upsert({
      where: { teacherId_offeringId: { teacherId: ts.teacherId, offeringId: m.offeringId } },
      create: { teacherId: ts.teacherId, offeringId: m.offeringId },
      update: {},
    });
  }

  // 5) RevisionRequest repoint (only rows still null), grouped by legacy subjectId.
  const legacySubjectIds = [...mapByLegacy.keys()];
  for (const legacyId of legacySubjectIds) {
    const m = mapByLegacy.get(legacyId)!;
    await prisma.revisionRequest.updateMany({
      where: { subjectId: legacyId, offeringId: null },
      data: { offeringId: m.offeringId, courseId: m.courseId },
    });
  }

  // ---------------- validation ----------------
  const [nOffer, nOC, nAbs, nDistinctName, nTO, nTS, nSubj] = await Promise.all([
    prisma.offering.count(),
    prisma.offeringCourse.count(),
    prisma.abstractSubject.count(),
    Promise.resolve(byName.size),
    prisma.teacherOffering.count(),
    prisma.teacherSubject.count(),
    prisma.subject.count(),
  ]);
  check("Offering count == legacy Subject count", nOffer === nSubj, `${nOffer} vs ${nSubj}`);
  check("OfferingCourse count == legacy Subject count", nOC === nSubj, `${nOC} vs ${nSubj}`);
  check("AbstractSubject count == distinct legacy names", nAbs === nDistinctName, `${nAbs} vs ${nDistinctName}`);
  check("TeacherOffering count == TeacherSubject count", nTO === nTS, `${nTO} vs ${nTS}`);

  // RevisionRequest: all repointed, and offering.subject.name / courseId match legacy.
  const legacyById = new Map(legacy.map((s) => [s.id, s]));
  const rrNull = await prisma.revisionRequest.count({ where: { offeringId: null } });
  check("RevisionRequest all have offeringId", rrNull === 0, `${rrNull} still null`);
  const rrSample = await prisma.revisionRequest.findMany({
    select: {
      subjectId: true,
      courseId: true,
      offering: { select: { subject: { select: { name: true } } } },
    },
  });
  let rrBad = 0;
  for (const rr of rrSample) {
    if (rr.subjectId == null) continue; // pre-existing rows all have it
    const legacyRow = legacyById.get(rr.subjectId);
    if (!legacyRow) { rrBad++; continue; }
    if (rr.offering?.subject.name !== legacyRow.name) rrBad++;
    else if (rr.courseId !== legacyRow.courseId) rrBad++;
  }
  check("RevisionRequest offering.name & courseId match legacy", rrBad === 0, `${rrBad} mismatched of ${rrSample.length}`);

  // Resolver oracle: newResolver(name, course.name, year) === legacy.spreadsheetId, for all rows.
  let oracleBad = 0;
  for (const s of legacy) {
    const resolved = await prisma.offering.findFirst({
      where: {
        subject: { name: s.name },
        offeringCourses: { some: { course: { name: s.course.name, year: s.course.year } } },
      },
      select: { spreadsheetId: true },
    });
    if ((resolved?.spreadsheetId ?? null) !== (s.spreadsheetId ?? null)) oracleBad++;
  }
  check("Resolver oracle matches for all legacy rows", oracleBad === 0, `${oracleBad} mismatched of ${legacy.length}`);

  await prisma.$disconnect();
  if (FAIL) {
    console.error("\nBACKFILL VALIDATION FAILED");
    process.exit(1);
  }
  console.log("\nBACKFILL OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
