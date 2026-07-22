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

export async function listOptionalOfferings(request: Request, response: Response) {
  const yearParam = Number(request.query.year);
  const year = Number.isInteger(yearParam) && yearParam > 0 ? yearParam : new Date().getFullYear();

  const [offerings, levelCounts] = await Promise.all([
    prisma.offering.findMany({
      where: { kind: "OPTIONAL", year },
      include: {
        subject: true,
        offeringCourses: { include: { course: true } },
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
    };
  });

  return response.status(200).send(result);
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
