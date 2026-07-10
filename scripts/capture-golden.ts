/**
 * TEMP verification harness (refactor: Subject -> Offering).
 * Invokes the real controllers with mock req/res so it exercises the actual
 * Prisma queries + response-shaping code, then writes each JSON payload to
 * $CAPTURE_DIR. Run once BEFORE the controller cutover and once AFTER, then diff.
 *
 * Params are discovered from the LEGACY tables (Subject/TeacherSubject/Course),
 * which persist through cutover, so the two runs request identical inputs.
 *
 * Run:  CAPTURE_DIR=/abs/path pnpm dlx tsx scripts/capture-golden.ts
 */
import "../loadEnv.ts";
import fs from "node:fs";
import path from "node:path";
import prisma from "../prisma/prisma.ts";
import {
  getAllSubjects,
  getTemplateSubjects,
  getTeacherSubjects,
} from "../controllers/subjects/allSubjects.ts";
import {
  getAllStudents,
  getSubjectStudents,
} from "../controllers/students/allStudents.ts";
import { getAllCourses } from "../controllers/courses/allCourses.ts";
import {
  getRevisionRequests,
  getRevisionRequestsByTeacher,
} from "../controllers/subjects/revision.ts";

const OUT = process.env.CAPTURE_DIR;
if (!OUT) throw new Error("CAPTURE_DIR env var required");
fs.mkdirSync(OUT, { recursive: true });

function mockRes() {
  const res: any = {
    _status: 200,
    _body: undefined as unknown,
    status(code: number) {
      this._status = code;
      return this;
    },
    send(body: unknown) {
      this._body = body;
      return this;
    },
    json(body: unknown) {
      this._body = body;
      return this;
    },
    setHeader() {
      return this;
    },
    set() {
      return this;
    },
  };
  return res;
}

async function capture(name: string, fn: Function, req: any) {
  const res = mockRes();
  try {
    await fn(req as any, res as any);
    const payload = { status: res._status, body: res._body };
    fs.writeFileSync(
      path.join(OUT!, `${name}.json`),
      JSON.stringify(payload, null, 2),
    );
    console.log(`captured ${name}  (status ${res._status})`);
  } catch (err) {
    fs.writeFileSync(
      path.join(OUT!, `${name}.ERROR.txt`),
      String(err instanceof Error ? err.stack : err),
    );
    console.error(`ERROR ${name}: ${err}`);
  }
}

async function main() {
  // --- discover params from the new tables (legacySubjectId reproduces the
  //     legacy Subject.id ordering, so the same sample triples are chosen) ---
  const templateIds = (
    await prisma.offering.findMany({
      distinct: ["templateId"],
      select: { templateId: true },
      orderBy: { templateId: "asc" },
    })
  ).map((s) => s.templateId);

  const teacherIds = (
    await prisma.teacherOffering.findMany({
      distinct: ["teacherId"],
      select: { teacherId: true },
      orderBy: { teacherId: "asc" },
    })
  ).map((t) => t.teacherId);

  const courseYears = (
    await prisma.course.findMany({
      distinct: ["year"],
      select: { year: true },
      orderBy: { year: "asc" },
    })
  ).map((c) => c.year);

  // a handful of (subject, course, year) triples for getSubjectStudents / getRevisionRequests
  const sampleRows = (
    await prisma.offeringCourse.findMany({
      take: 6,
      orderBy: { legacySubjectId: "asc" },
      select: {
        offering: { select: { subject: { select: { name: true } } } },
        course: { select: { name: true, year: true } },
      },
    })
  ).map((oc) => ({ name: oc.offering.subject.name, course: oc.course }));

  // --- no-auth, no-param ---
  await capture("subjects", getAllSubjects, { params: {}, query: {} });
  await capture("courses", getAllCourses, { params: {}, query: {} });

  // --- /subjects/:templateId (each distinct) ---
  for (const t of templateIds) {
    await capture(`subjects_template_${t}`, getTemplateSubjects, {
      params: { templateId: t },
      query: {},
    });
  }

  // --- /subjects/teacher/:teacherId (admin path, per teacher) ---
  for (const id of teacherIds) {
    await capture(`subjects_teacher_${id}`, getTeacherSubjects, {
      params: { teacherId: String(id) },
      query: {},
      user: { id, role: "ADMIN" },
    });
  }

  // --- /students (auth) ---
  await capture("students", getAllStudents, {
    params: {},
    query: {},
    user: { id: teacherIds[0] ?? 0, role: "ADMIN" },
  });

  // --- /students/:subject/:course/:year (sample) ---
  for (const r of sampleRows) {
    const key = `${r.name}|${r.course.name}|${r.course.year}`.replace(
      /[^A-Za-z0-9]/g,
      "_",
    );
    await capture(`subjectStudents_${key}`, getSubjectStudents, {
      params: {
        subject: r.name,
        course: r.course.name,
        year: String(r.course.year),
      },
      query: {},
    });
  }

  // --- /revisionRequests/teacher/:year/:teacherId ---
  for (const y of courseYears) {
    for (const id of teacherIds) {
      await capture(`revByTeacher_${y}_${id}`, getRevisionRequestsByTeacher, {
        params: { year: String(y), teacherId: String(id) },
        query: {},
        user: { id, role: "ADMIN" },
      });
    }
  }

  // --- /revisionRequests/:subject/:course/:year/:id (sample; id=0 -> just shape) ---
  for (const r of sampleRows) {
    const key = `${r.name}|${r.course.name}|${r.course.year}`.replace(
      /[^A-Za-z0-9]/g,
      "_",
    );
    await capture(`revRequests_${key}`, getRevisionRequests, {
      params: {
        subject: r.name,
        course: r.course.name,
        year: String(r.course.year),
        id: "0",
      },
      query: {},
    });
  }

  await prisma.$disconnect();
  console.log("DONE");
}

main();
