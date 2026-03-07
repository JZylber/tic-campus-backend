import type { Request, Response } from "express";
import prisma from "../../prisma/prisma.ts";

export async function requestRedo(
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
  // Check that there are no redo request for the same activity and student that are not reviewed yet
  const existingRedos = (
    await prisma.redo.findMany({
      where: {
        studentSubject: {
          subject: {
            name: subject,
            year,
          },
          studentCourse: {
            course,
            student: {
              id: { in: studentIds.map((id) => parseInt(id)) },
            },
          },
        },
        activityId: activityId,
        reviewed: false,
      },
      select: {
        studentSubject: {
          select: {
            studentCourse: {
              select: {
                student: {
                  select: { name: true, surname: true },
                },
              },
            },
          },
        },
      },
    })
  ).map((redo) => ({
    name: redo.studentSubject.studentCourse.student.name,
    surname: redo.studentSubject.studentCourse.student.surname,
  }));
  if (existingRedos.length > 0) {
    const studentNames = existingRedos
      .map((student) => `${student.name} ${student.surname}`)
      .join(", ");
    return response.status(400).send({
      message: `Ya existe una solicitud de reentrega para esta actividad que no ha sido revisada aún de los siguientes estudiantes: ${studentNames}`,
    });
  }
  // Create redo request for each student
  // Get studentSubjectId for each student
  const studentSubjects = await prisma.studentSubject.findMany({
    where: {
      subject: {
        name: subject,
        year,
      },
      studentCourse: {
        course,
        student: {
          id: { in: studentIds.map((id) => parseInt(id)) },
        },
      },
    },
  });
  const redosData = studentSubjects.map((studentSubject) => ({
    studentSubjectId: studentSubject.id,
    activityId,
    reason,
    bonusTasks: bonusTasks || null,
    comment: comment || null,
    date,
  }));
  await prisma.redo.createMany({
    data: redosData,
  });
  return response
    .status(200)
    .send({ message: "¡Reentrega solicitada exitosamente!" });
}
