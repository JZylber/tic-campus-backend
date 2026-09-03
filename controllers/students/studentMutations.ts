import type { Request, Response } from "express";
import prisma from "../../prisma/prisma.ts";
import { composeSubjectName } from "../offerings/offeringQueries.ts";

// Optional-offering matches read back with enough of the offering attached to
// name them in a response — the caller has to be able to tell the admin which
// ones a course move or removal took away.
const optionalMatchSelect = {
  offeringId: true,
  eligible: {
    select: {
      offering: { select: { name: true, subject: { select: { name: true } } } },
    },
  },
} as const;

type OptionalMatch = {
  offeringId: number;
  eligible: { offering: { name: string | null; subject: { name: string } } };
};

const asDroppedOffering = (match: OptionalMatch) => ({
  offeringId: match.offeringId,
  displayName: composeSubjectName(
    match.eligible.offering.subject.name,
    match.eligible.offering.name,
  ),
});

export async function addStudentToCourse(
  request: Request<{ studentId: string }, {}, { courseId: number }>,
  response: Response,
) {
  const studentId = Number(request.params.studentId);
  const { courseId } = request.body;

  const existing = await prisma.studentCourse.findFirst({
    where: { studentId, courseId },
  });
  if (existing) {
    return response.status(409).send({ error: "Student already enrolled in this course" });
  }

  const studentCourse = await prisma.studentCourse.create({
    data: { studentId, courseId },
    include: { course: true },
  });
  return response.status(201).send({
    courseId: studentCourse.course.id,
    course: studentCourse.course.name,
    year: studentCourse.course.year,
  });
}

export async function changeStudentCourse(
  request: Request<{ studentId: string }, {}, { oldCourseId: number; newCourseId: number }>,
  response: Response,
) {
  const studentId = Number(request.params.studentId);
  const { oldCourseId, newCourseId } = request.body;

  const enrollment = await prisma.studentCourse.findFirst({
    where: { studentId, courseId: oldCourseId },
  });
  if (!enrollment) {
    return response.status(404).send({ error: "Enrollment not found" });
  }

  const newCourse = await prisma.course.findUnique({ where: { id: newCourseId } });
  if (!newCourse) {
    return response.status(404).send({ error: "Target course not found" });
  }

  const alreadyThere = await prisma.studentCourse.findFirst({
    where: { studentId, courseId: newCourseId },
  });
  if (alreadyThere) {
    return response.status(409).send({ error: "Student already enrolled in this course" });
  }

  // StudentOffering points at (studentId, courseId), so the optional enrollments
  // have to be torn down and rebuilt around the move. Matches whose offering also
  // serves the new course are carried over; the rest cannot follow the student,
  // and are named in `droppedOfferings` so the move never loses them silently.
  const { moved, droppedOfferings } = await prisma.$transaction(async (tx) => {
    const optionals = await tx.studentOffering.findMany({
      where: { studentId, courseId: oldCourseId },
      select: optionalMatchSelect,
    });
    const offeringIds = optionals.map((so) => so.offeringId);

    const transferable = offeringIds.length
      ? await tx.offeringCourse.findMany({
          where: { courseId: newCourseId, offeringId: { in: offeringIds } },
          select: { offeringId: true },
        })
      : [];
    const transferableIds = new Set(transferable.map((oc) => oc.offeringId));

    if (offeringIds.length) {
      await tx.studentOffering.deleteMany({ where: { studentId, courseId: oldCourseId } });
    }

    const updated = await tx.studentCourse.update({
      where: { id: enrollment.id },
      data: { courseId: newCourseId },
      include: { course: true },
    });

    if (transferableIds.size) {
      await tx.studentOffering.createMany({
        data: [...transferableIds].map((offeringId) => ({
          studentId,
          courseId: newCourseId,
          offeringId,
        })),
      });
    }

    return {
      moved: updated,
      droppedOfferings: optionals
        .filter((so) => !transferableIds.has(so.offeringId))
        .map(asDroppedOffering),
    };
  });

  return response.status(200).send({
    courseId: moved.course.id,
    course: moved.course.name,
    year: moved.course.year,
    droppedOfferings,
  });
}

export async function deleteStudentFromCourse(
  request: Request<{ studentId: string; courseId: string }>,
  response: Response,
) {
  const studentId = Number(request.params.studentId);
  const courseId = Number(request.params.courseId);

  const enrollment = await prisma.studentCourse.findFirst({
    where: { studentId, courseId },
  });
  if (!enrollment) {
    return response.status(404).send({ error: "Enrollment not found" });
  }

  // Optional-offering matches hang off (studentId, courseId); leaving the course
  // means leaving its offerings, so they go first or the FK blocks the delete.
  // They come back named, so the removal never loses them silently.
  const { deleted, droppedOfferings } = await prisma.$transaction(async (tx) => {
    const optionals = await tx.studentOffering.findMany({
      where: { studentId, courseId },
      select: optionalMatchSelect,
    });
    if (optionals.length) {
      await tx.studentOffering.deleteMany({ where: { studentId, courseId } });
    }
    return {
      deleted: await tx.studentCourse.delete({ where: { id: enrollment.id } }),
      droppedOfferings: optionals.map(asDroppedOffering),
    };
  });
  return response.status(200).send({ ...deleted, droppedOfferings });
}

export async function updateStudent(
  request: Request<
    { studentId: string },
    {},
    { name?: string; surname?: string; email?: string; dni?: string }
  >,
  response: Response,
) {
  const studentId = Number(request.params.studentId);
  const { name, surname, email, dni } = request.body;

  const data = Object.fromEntries(
    Object.entries({ name, surname, email, dni }).filter(([, v]) => v !== undefined),
  ) as { name?: string; surname?: string; email?: string; dni?: string };

  const updated = await prisma.user.update({
    where: { id: studentId },
    data,
    select: { id: true, name: true, surname: true, email: true, dni: true, role: true },
  });
  return response.status(200).send(updated);
}
