import type { Request, Response } from "express";
import prisma from "../../prisma/prisma.ts";
import { setCacheHeaders } from "../shared.ts";
import { composeSubjectName } from "../offerings/optionalOfferingQueries.ts";

export async function getRevisionRequests(
  request: Request<
    { course: string; year: string; subject: string; id: string },
    {},
    {},
    {}
  >,
  response: Response,
) {
  const { subject, course, year, id } = request.params;
  const pendingRequestIds = await prisma.revisionRequest
    .findMany({
      where: {
        reviewed: false,
        offering: {
          subject: {
            name: subject,
          },
        },
        course: {
          name: course,
          year: Number(year),
        },
        studentId: parseInt(id),
      },
      select: {
        activityId: true,
      },
    })
    .then((revisionRequests) =>
      revisionRequests.map((request) => request.activityId.toString()),
    );
  setCacheHeaders(response, 100);
  return response.status(200).send(pendingRequestIds);
}

export async function requestRevision(
  request: Request<
    {},
    {},
    {
      subject: string;
      course: string;
      year: number;
      studentIds: string[];
      activityId: string;
      reason: string;
      bonusTasks?: string;
      comment?: string;
    }
  >,
  response: Response,
) {
  const {
    subject,
    course,
    year,
    studentIds,
    activityId,
    reason,
    bonusTasks,
    comment,
  } = request.body;
  // Current date in Argentina timezone
  const date = new Date(
    new Date().toLocaleString("en-US", {
      timeZone: "America/Argentina/Buenos_Aires",
    }),
  );
  // Month must be betwwen march and november, and year must be current year
  const currentMonth = date.getMonth() + 1;
  const currentYear = date.getFullYear();
  if (currentMonth < 2 || currentMonth > 11) {
    return response.status(400).send({
      message: "Solo se pueden solicitar reentregas entre marzo y noviembre.",
    });
  }
  if (currentYear !== year) {
    return response.status(400).send({
      message: "Las reentregas solo pueden ser solicitadas para el año actual.",
    });
  }
  // Check that there are no revision requests for the same activity and student that are not reviewed yet
  const existingRevisionRequests = (
    await prisma.revisionRequest.findMany({
      where: {
        offering: {
          subject: {
            name: subject,
          },
        },
        course: {
          name: course,
          year: Number(year),
        },
        studentId: {
          in: studentIds.map((id) => parseInt(id)),
        },
        activityId: activityId,
        reviewed: false,
      },
      select: {
        student: {
          select: {
            id: true,
            name: true,
            surname: true,
          },
        },
      },
    })
  ).map((redo) => ({
    name: redo.student.name,
    surname: redo.student.surname,
  }));
  if (existingRevisionRequests.length > 0) {
    const studentNames = existingRevisionRequests
      .map((student) => `${student.name} ${student.surname}`)
      .join(", ");
    return response.status(400).send({
      message: `Ya existe una solicitud de reentrega para esta actividad que no ha sido revisada aún de los siguientes estudiantes: ${studentNames}`,
    });
  }
  // Create revision request for each student.
  // Resolve the offering for this subject on the given course/year, and the
  // exact course it is linked to (authoritative even if course names collide).
  const offering = await prisma.offering.findFirst({
    where: {
      subject: { name: subject },
      offeringCourses: { some: { course: { name: course, year: Number(year) } } },
    },
    select: {
      id: true,
      offeringCourses: {
        where: { course: { name: course, year: Number(year) } },
        select: { courseId: true },
      },
    },
  });
  const offeringId = offering!.id;
  const courseId = offering!.offeringCourses[0]!.courseId;
  const revisionData = studentIds.map((id) => ({
    studentId: parseInt(id),
    offeringId,
    courseId,
    activityId,
    reason,
    bonusTasks: bonusTasks || null,
    comment: comment || null,
    date,
  }));
  await prisma.revisionRequest.createMany({
    data: revisionData,
  });
  return response
    .status(200)
    .send({ message: "¡Reentrega solicitada exitosamente!" });
}

export async function getRevisionRequestsByTeacher(
  request: Request<{ year: string; teacherId: string }, {}, {}, {}>,
  response: Response,
) {
  const user = request.user as { id: number; role: string };
  const { year } = request.params;
  const teacherId =
    user.role === "TEACHER" ? user.id : parseInt(request.params.teacherId);
  const revisionRequests = await prisma.revisionRequest.findMany({
    where: {
      offering: {
        year: parseInt(year),
        teacherOfferings: {
          some: {
            teacherId: teacherId,
          },
        },
      },
    },
    // Deterministic ordering (the legacy query had none, so its order was
    // plan-dependent). courseName/courseYear now come from the request's own
    // course (the specific cohort), correct even when an offering spans courses.
    orderBy: { id: "asc" },
    select: {
      id: true,
      student: {
        select: {
          id: true,
          name: true,
          surname: true,
        },
      },
      offering: {
        select: {
          name: true,
          subject: { select: { name: true } },
        },
      },
      course: {
        select: {
          name: true,
          year: true,
        },
      },
      activityId: true,
      reason: true,
      bonusTasks: true,
      comment: true,
      date: true,
      reviewed: true,
    },
  });
  // Flatten the response
  const flattenedRequests = revisionRequests.map((request) => ({
    revisionRequestId: request.id,
    studentId: request.student.id,
    studentName: request.student.name,
    studentSurname: request.student.surname,
    subjectName: composeSubjectName(request.offering!.subject.name, request.offering!.name),
    courseName: request.course!.name,
    courseYear: request.course!.year,
    activityId: request.activityId,
    reason: request.reason,
    bonusTasks: request.bonusTasks,
    comment: request.comment,
    date: request.date,
    reviewed: request.reviewed,
  }));
  return response.status(200).send(flattenedRequests);
}

export async function toggleRevisionRequestReviewed(
  request: Request<{ id: string }, {}, { reviewed: boolean }>,
  response: Response,
) {
  const id = parseInt(request.params.id);
  const { reviewed } = request.body;

  const existing = await prisma.revisionRequest.findUnique({ where: { id } });
  if (!existing) {
    return response
      .status(404)
      .send({ message: "Solicitud de reentrega no encontrada." });
  }

  const updated = await prisma.revisionRequest.update({
    where: { id },
    data: { reviewed },
    select: { id: true, reviewed: true },
  });

  return response.status(200).send(updated);
}
