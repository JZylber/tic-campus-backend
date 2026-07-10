/**
 * CONTRACT STEP 1 — dedup duplicate Course + StudentCourse rows.
 * PREREQUISITE for adding Course @@unique([name,year]) and
 * StudentCourse @@unique([studentId,courseId]).
 *
 * For each duplicate (name, year) Course group: keep the lowest id as winner,
 * repoint every FK (StudentCourse, OfferingCourse, RevisionRequest.courseId,
 * legacy Subject.courseId) from losers -> winner (collision-safe), then delete
 * the loser Course rows. Also collapses any duplicate StudentCourse rows.
 *
 * ⚠️ NOT byte-identical. Visible effects (need product sign-off):
 *   - GET /courses drops from 35 -> 33 rows.
 *   - The split NR4C/NR4E 2025 cohorts get UNITED with their offering, so
 *     getSubjectStudents / marks roster / getAllStudents.subjects for
 *     "Bases de Datos" on those courses go from 0 students -> 32 / 27
 *     (a correction of a latent data split).
 *
 * Idempotent. DRY RUN by default — prints the plan and mutates nothing.
 * Run for real with:  DRY_RUN=false DATABASE_URL=... pnpm dlx tsx scripts/contract/01-dedup.ts
 */
import "../../loadEnv.ts";
import prisma from "../../prisma/prisma.ts";

const DRY = process.env.DRY_RUN !== "false"; // default = dry run

async function raw<T>(sql: string, ...args: unknown[]): Promise<T[]> {
  return prisma.$queryRawUnsafe<T[]>(sql, ...args);
}

async function main() {
  console.log(DRY ? "=== DRY RUN (no mutations) ===\n" : "=== EXECUTING (mutations ON) ===\n");

  // 1) Collapse duplicate StudentCourse (studentId,courseId) rows — keep lowest id.
  const scDupes = await raw<{ studentId: number; courseId: number; ids: number[] }>(
    `SELECT "studentId","courseId", array_agg(id ORDER BY id) AS ids
     FROM "StudentCourse" GROUP BY "studentId","courseId" HAVING COUNT(*)>1`,
  );
  let scDupDeletes = 0;
  for (const d of scDupes) {
    const extra = d.ids.slice(1);
    scDupDeletes += extra.length;
    if (!DRY && extra.length)
      await prisma.studentCourse.deleteMany({ where: { id: { in: extra } } });
  }
  console.log(`Duplicate StudentCourse rows to delete: ${scDupDeletes}`);

  // 2) Duplicate Course (name,year) groups.
  const groups = await raw<{ name: string; year: number; ids: number[] }>(
    `SELECT name, year, array_agg(id ORDER BY id) AS ids
     FROM "Course" GROUP BY name, year HAVING COUNT(*)>1 ORDER BY name, year`,
  );
  if (groups.length === 0) console.log("\nNo duplicate Course groups.");

  for (const g of groups) {
    const [winner, ...losers] = g.ids;
    console.log(`\nCourse "${g.name}" ${g.year}: winner=${winner}, losers=[${losers.join(",")}]`);

    for (const L of losers) {
      // --- StudentCourse: drop loser rows that would collide on (studentId, winner), then repoint ---
      const scCollide = await raw<{ studentId: number }>(
        `SELECT a."studentId" FROM "StudentCourse" a
         WHERE a."courseId"=$1 AND EXISTS
           (SELECT 1 FROM "StudentCourse" b WHERE b."courseId"=$2 AND b."studentId"=a."studentId")`,
        L, winner,
      );
      const scMoved = (await raw<{ n: bigint }>(
        `SELECT COUNT(*)::bigint n FROM "StudentCourse" WHERE "courseId"=$1`, L,
      ))[0]!.n;
      console.log(`  StudentCourse: repoint ${scMoved} (collisions dropped: ${scCollide.length})`);
      if (!DRY) {
        if (scCollide.length)
          await prisma.studentCourse.deleteMany({
            where: { courseId: L, studentId: { in: scCollide.map((r) => r.studentId) } },
          });
        await prisma.studentCourse.updateMany({ where: { courseId: L }, data: { courseId: winner } });
      }

      // --- OfferingCourse: drop loser rows that would collide on (offeringId, winner), then repoint ---
      const ocCollide = await raw<{ offeringId: number }>(
        `SELECT a."offeringId" FROM "OfferingCourse" a
         WHERE a."courseId"=$1 AND EXISTS
           (SELECT 1 FROM "OfferingCourse" b WHERE b."courseId"=$2 AND b."offeringId"=a."offeringId")`,
        L, winner,
      );
      const ocMoved = (await raw<{ n: bigint }>(
        `SELECT COUNT(*)::bigint n FROM "OfferingCourse" WHERE "courseId"=$1`, L,
      ))[0]!.n;
      console.log(`  OfferingCourse: repoint ${ocMoved} (collisions dropped: ${ocCollide.length})`);
      if (!DRY) {
        if (ocCollide.length)
          await prisma.offeringCourse.deleteMany({
            where: { courseId: L, offeringId: { in: ocCollide.map((r) => r.offeringId) } },
          });
        await prisma.offeringCourse.updateMany({ where: { courseId: L }, data: { courseId: winner } });
      }

      // --- RevisionRequest.courseId (no unique) ---
      const rrMoved = (await raw<{ n: bigint }>(
        `SELECT COUNT(*)::bigint n FROM "RevisionRequest" WHERE "courseId"=$1`, L,
      ))[0]!.n;
      console.log(`  RevisionRequest.courseId: repoint ${rrMoved}`);
      if (!DRY) await prisma.revisionRequest.updateMany({ where: { courseId: L }, data: { courseId: winner } });

      // --- legacy Subject.courseId (still present until step 3 drops the table) ---
      const subMoved = (await raw<{ n: bigint }>(
        `SELECT COUNT(*)::bigint n FROM "Subject" WHERE "courseId"=$1`, L,
      ))[0]!.n;
      console.log(`  legacy Subject.courseId: repoint ${subMoved}`);
      if (!DRY) await prisma.subject.updateMany({ where: { courseId: L }, data: { courseId: winner } });

      // --- delete the loser Course ---
      console.log(`  delete Course ${L}`);
      if (!DRY) await prisma.course.delete({ where: { id: L } });
    }
  }

  // 3) Post validation (only meaningful after a real run).
  const remainingDupCourses = (await raw<{ n: bigint }>(
    `SELECT COUNT(*)::bigint n FROM (SELECT 1 FROM "Course" GROUP BY name,year HAVING COUNT(*)>1) t`,
  ))[0]!.n;
  const remainingDupSC = (await raw<{ n: bigint }>(
    `SELECT COUNT(*)::bigint n FROM (SELECT 1 FROM "StudentCourse" GROUP BY "studentId","courseId" HAVING COUNT(*)>1) t`,
  ))[0]!.n;
  const orphanOC = (await raw<{ n: bigint }>(
    `SELECT COUNT(*)::bigint n FROM "OfferingCourse" oc LEFT JOIN "Course" c ON c.id=oc."courseId" WHERE c.id IS NULL`,
  ))[0]!.n;
  console.log(
    `\nPost-check ${DRY ? "(projected — dry run, still shows current state)" : ""}:`,
    `dupCourses=${remainingDupCourses} dupStudentCourse=${remainingDupSC} orphanOfferingCourse=${orphanOC}`,
  );
  if (!DRY) {
    const ok = remainingDupCourses === 0n && remainingDupSC === 0n && orphanOC === 0n;
    console.log(ok ? "\nDEDUP OK" : "\nDEDUP VALIDATION FAILED");
    if (!ok) process.exit(1);
  } else {
    console.log("\n(dry run complete — re-run with DRY_RUN=false to apply)");
  }
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
