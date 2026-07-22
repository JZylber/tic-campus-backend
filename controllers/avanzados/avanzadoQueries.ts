import type { Request, Response } from "express";
import prisma from "../../prisma/prisma.ts";
import { OfferingKind, Semester } from "../../generated/prisma/enums.ts";
import { composeSubjectName } from "../offerings/offeringQueries.ts";

function levelOf(courseName: string): number {
  return Number(courseName[2] || 0);
}

// Lists every student enrolled in a level-3 or level-4 course for the given
// year, one row per (student, course) pair, alongside the OPTIONAL/SECOND
// (i.e. "avanzado") offerings they're currently matched to. MANDATORY and
// FIRST/BOTH-semester offerings a course carries are irrelevant here.
export async function listAvanzadoStudents(request: Request, response: Response) {
  const yearParam = Number(request.query.year);
  const year = Number.isInteger(yearParam) && yearParam > 0 ? yearParam : new Date().getFullYear();

  const courses = await prisma.course.findMany({ where: { year }, select: { id: true, name: true } });
  const levelByCourseId = new Map(courses.map((c) => [c.id, levelOf(c.name)]));
  // Avanzados only run for the NR specialty — NI3x/NI4x are a different
  // specialty and don't take part in these seminars (same exclusion as the
  // Materias/offerings admin tab applies to optional level-4 offerings).
  const courseIds = courses
    .filter((c) => c.name.startsWith("NR") && [3, 4].includes(levelOf(c.name)))
    .map((c) => c.id);

  if (courseIds.length === 0) {
    return response.status(200).send([]);
  }

  const studentCourses = await prisma.studentCourse.findMany({
    where: { courseId: { in: courseIds } },
    include: {
      student: true,
      course: true,
      studentOfferings: {
        include: { eligible: { include: { offering: { include: { subject: true } } } } },
      },
    },
  });

  const result = studentCourses
    .map((sc) => ({
      studentId: sc.student.id,
      name: sc.student.name!,
      surname: sc.student.surname!,
      courseId: sc.course.id,
      courseName: sc.course.name,
      level: levelByCourseId.get(sc.courseId) ?? 0,
      avanzados: sc.studentOfferings
        .filter(
          (so) =>
            so.eligible.offering.kind === OfferingKind.OPTIONAL &&
            so.eligible.offering.semester === Semester.SECOND,
        )
        .map((so) => ({
          offeringId: so.offeringId,
          subjectName: so.eligible.offering.subject.name,
          name: so.eligible.offering.name,
          displayName: composeSubjectName(so.eligible.offering.subject.name, so.eligible.offering.name),
        })),
    }))
    .sort((a, b) => {
      if (a.surname !== b.surname) return a.surname.localeCompare(b.surname, "es");
      return a.name.localeCompare(b.name, "es");
    });

  return response.status(200).send(result);
}
