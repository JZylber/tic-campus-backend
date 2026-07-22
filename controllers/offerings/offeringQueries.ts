import type { Request, Response } from "express";
import prisma from "../../prisma/prisma.ts";

type OfferingCourseWithCourse = {
  courseId: number;
  course: { name: string };
};

// A subject offered to every course of its level (e.g. all of NR31/32/33/34)
// is shown as just the subject name — the "(letters)" clarification only
// exists to distinguish which rotation a subject is offered to, so it's
// noise once the subject covers the whole level.
export function buildDisplayName(
  subjectName: string,
  offeringCourses: OfferingCourseWithCourse[],
  totalCoursesForLevel: number,
): string {
  if (totalCoursesForLevel > 0 && offeringCourses.length >= totalCoursesForLevel) {
    return subjectName;
  }
  const divisions = offeringCourses
    .map((oc) => oc.course.name[3] || "")
    .filter((d) => d !== "")
    .sort();
  return divisions.length ? `${subjectName} (${divisions.join("")})` : subjectName;
}

// Composes the display-facing subject name with its offering's name, when
// set, to disambiguate multiple offerings of the same subject (e.g. two
// different optional variants). Only safe to use where the result is pure
// display — never as a lookup key, since Subject.name alone is what's
// matched against elsewhere (marks/articles/material/links/routing).
export function composeSubjectName(
  subjectName: string,
  offeringName: string | null | undefined,
): string {
  return offeringName ? `${subjectName}-${offeringName}` : subjectName;
}

export function levelFromCourses(offeringCourses: OfferingCourseWithCourse[]): number {
  const first = offeringCourses[0];
  return first ? Number(first.course.name[2] || 0) : 0;
}

export async function countCoursesForLevelYear(year: number, level: number): Promise<number> {
  const courses = await prisma.course.findMany({ where: { year }, select: { name: true } });
  return courses.filter((c) => Number(c.name[2] || 0) === level).length;
}

export async function countCoursesByLevel(year: number): Promise<Map<number, number>> {
  const courses = await prisma.course.findMany({ where: { year }, select: { name: true } });
  const counts = new Map<number, number>();
  for (const c of courses) {
    const level = Number(c.name[2] || 0);
    counts.set(level, (counts.get(level) || 0) + 1);
  }
  return counts;
}

export async function courseIdsForLevel(year: number, level: number): Promise<number[]> {
  const courses = await prisma.course.findMany({
    where: { year },
    select: { id: true, name: true },
  });
  return courses.filter((c) => Number(c.name[2] || 0) === level).map((c) => c.id);
}

// Lists offerings of any kind (MANDATORY or OPTIONAL) for a year, with
// their time slots included — the data source for the admin timetable
// editor, which needs to schedule the regular curriculum, not just
// electives.
export async function listOfferings(request: Request, response: Response) {
  const yearParam = Number(request.query.year);
  const year = Number.isInteger(yearParam) && yearParam > 0 ? yearParam : new Date().getFullYear();

  const [offerings, levelCounts] = await Promise.all([
    prisma.offering.findMany({
      where: { year },
      include: {
        subject: true,
        offeringCourses: { include: { course: true } },
        timeSlots: true,
      },
      orderBy: [{ subject: { name: "asc" } }],
    }),
    countCoursesByLevel(year),
  ]);

  const result = offerings.map((offering) => {
    const level = levelFromCourses(offering.offeringCourses);
    return {
      id: offering.id,
      subjectId: offering.subjectId,
      subjectName: offering.subject.name,
      name: offering.name,
      kind: offering.kind,
      year: offering.year,
      level,
      templateId: offering.templateId,
      spreadsheetId: offering.spreadsheetId,
      semester: offering.semester,
      displayName: buildDisplayName(
        composeSubjectName(offering.subject.name, offering.name),
        offering.offeringCourses,
        levelCounts.get(level) ?? 0,
      ),
      courses: offering.offeringCourses.map((oc) => ({
        courseId: oc.courseId,
        courseName: oc.course.name,
        division: oc.course.name[3] || "",
      })),
      timeSlots: offering.timeSlots.map((s) => ({
        id: s.id,
        day: s.day,
        slot: s.slot,
        classroom: s.classroom,
      })),
    };
  });

  return response.status(200).send(result);
}

export async function listSubjectsCatalog(_request: Request, response: Response) {
  const subjects = await prisma.subject.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return response.status(200).send(subjects);
}

// Public (no auth) counterpart of listOfferings, scoped to one subject and
// level rather than an admin-wide year catalog — used by the public
// student-facing Proyecto timetable page, which has no JWT to gate on.
// studentId is tolerated loosely (like getStudentMarks): an invalid/unknown
// id simply yields no enrollments rather than an error.
export async function getPublicOfferingsBySubjectLevel(
  request: Request<{ subject: string; year: string; level: string; studentId: string }>,
  response: Response,
) {
  const { subject, year: yearParam, level: levelParam, studentId: studentIdParam } = request.params;
  const year = Number(yearParam);
  const level = Number(levelParam);
  const studentId = Number(studentIdParam);

  if (!Number.isInteger(year) || !Number.isInteger(level)) {
    return response.status(400).send({ message: "Invalid year or level" });
  }

  const courseIds = await courseIdsForLevel(year, level);

  // Avanzado/seminar offerings are OPTIONAL offerings under their own
  // subjects (e.g. "IA", "UX/UI") that share the level's courses, not
  // sub-offerings of the mandatory subject itself — only the MANDATORY side
  // is actually scoped to `subject` (e.g. "Proyecto"); any OPTIONAL offering
  // reachable from this level's courses counts, regardless of its subject.
  const [offerings, levelCounts] = await Promise.all([
    prisma.offering.findMany({
      where: {
        year,
        offeringCourses: { some: { courseId: { in: courseIds } } },
        OR: [{ kind: "MANDATORY", subject: { name: subject } }, { kind: "OPTIONAL" }],
      },
      include: {
        subject: true,
        offeringCourses: { include: { course: true } },
        timeSlots: true,
      },
    }),
    countCoursesByLevel(year),
  ]);

  const enrolledIds = Number.isInteger(studentId)
    ? new Set(
        (
          await prisma.studentOffering.findMany({
            where: { studentId, offeringId: { in: offerings.map((o) => o.id) } },
            select: { offeringId: true },
          })
        ).map((r) => r.offeringId),
      )
    : new Set<number>();

  const result = offerings.map((offering) => {
    const offeringLevel = levelFromCourses(offering.offeringCourses);
    return {
      id: offering.id,
      subjectId: offering.subjectId,
      subjectName: offering.subject.name,
      name: offering.name,
      kind: offering.kind,
      year: offering.year,
      level: offeringLevel,
      templateId: offering.templateId,
      spreadsheetId: offering.spreadsheetId,
      semester: offering.semester,
      displayName: buildDisplayName(
        composeSubjectName(offering.subject.name, offering.name),
        offering.offeringCourses,
        levelCounts.get(offeringLevel) ?? 0,
      ),
      courses: offering.offeringCourses.map((oc) => ({
        courseId: oc.courseId,
        courseName: oc.course.name,
        division: oc.course.name[3] || "",
      })),
      timeSlots: offering.timeSlots.map((s) => ({
        id: s.id,
        day: s.day,
        slot: s.slot,
        classroom: s.classroom,
      })),
      enrolled: offering.kind === "OPTIONAL" && enrolledIds.has(offering.id),
    };
  });

  return response.status(200).send(result);
}
