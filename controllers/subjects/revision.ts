import type { Request, Response } from "express";
import prisma from "../../prisma/prisma.ts";

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
        subject: {
          name: subject,
          course: {
            name: course,
            year: Number(year),
          },
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
        subject: {
          select: {
            id: true,
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
  // Create revision request for each student
  // Get subjectCourseId
  const subjectId = await prisma.subject
    .findFirst({
      where: {
        name: subject,
        course: {
          name: course,
          year: Number(year),
        },
      },
      select: {
        id: true,
      },
    })
    .then((subject) => subject!.id);
  const revisionData = studentIds.map((id) => ({
    studentId: parseInt(id),
    subjectId,
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
