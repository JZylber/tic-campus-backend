import type { Request, Response } from "express";
import prisma from "../../prisma/prisma.ts";
import { OfferingKind, Role } from "../../generated/prisma/enums.ts";

// The CSV-exportable roster for an offering — every student who actually
// takes it. MANDATORY offerings take the whole course; OPTIONAL offerings
// (electives/avanzados/seminars) are gated on StudentOffering, same rule
// used for marks rosters (controllers/students/marks.ts) and avanzado
// listings (controllers/avanzados/avanzadoQueries.ts). Not cached: this is
// personal data (email/DNI), and setCacheHeaders emits `public` CDN directives.
export async function getOfferingRoster(
  request: Request<{ offeringId: string }>,
  response: Response,
) {
  const offeringId = Number(request.params.offeringId);
  if (!Number.isInteger(offeringId) || offeringId <= 0) {
    return response.status(400).send({ message: "Invalid offering id" });
  }

  const offering = await prisma.offering.findUnique({
    where: { id: offeringId },
    select: {
      id: true,
      kind: true,
      offeringCourses: { select: { courseId: true } },
    },
  });
  if (!offering) {
    return response.status(404).send({ message: "Offering not found" });
  }

  const courseIds = offering.offeringCourses.map((oc) => oc.courseId);
  if (courseIds.length === 0) {
    return response.status(200).send([]);
  }

  const students = await prisma.user.findMany({
    where: {
      role: Role.STUDENT,
      studentCourses: {
        some: {
          courseId: { in: courseIds },
          ...(offering.kind === OfferingKind.OPTIONAL
            ? { studentOfferings: { some: { offeringId: offering.id } } }
            : {}),
        },
      },
    },
    select: {
      id: true,
      name: true,
      surname: true,
      email: true,
      dni: true,
      studentCourses: {
        where: { courseId: { in: courseIds } },
        select: { course: { select: { name: true } } },
      },
    },
  });

  const result = students
    .map((student) => ({
      studentId: student.id,
      name: student.name ?? "",
      surname: student.surname ?? "",
      email: student.email,
      dni: student.dni ?? "",
      courseName: student.studentCourses[0]?.course.name ?? "",
    }))
    .sort(
      (a, b) =>
        a.courseName.localeCompare(b.courseName, "es") ||
        a.surname.localeCompare(b.surname, "es") ||
        a.name.localeCompare(b.name, "es"),
    );

  return response.status(200).send(result);
}
