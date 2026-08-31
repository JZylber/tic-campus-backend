import type { Request, Response } from "express";
import prisma from "../../prisma/prisma.ts";
import { Role } from "../../generated/prisma/enums.ts";
import {
  fetchLoggedInData,
  sanitizeCampusCookie,
} from "../../connectors/campus.ts";
import { backfillCampusId, resolveStudent } from "./identity.ts";
import {
  CAMPUS_TOKEN_TTL_SECONDS,
  IMPERSONATION_TOKEN_TTL_SECONDS,
  clearStudentCookie,
  setStudentCookie,
  signStudentToken,
} from "../../auth/studentJwt.ts";
import type { StudentTokenPayload } from "../../auth/studentJwt.ts";

// Year-2025 spreadsheets key `Id Estudiante` on the DNI rather than our
// User.id, so the archive pages must be handed the DNI as the student id.
// See controllers/students/marks.ts.
const DNI_KEYED_YEAR = 2025;

const publicStudentId = (
  year: number,
  id: number,
  dni: string | null,
): string => (year === DNI_KEYED_YEAR && dni ? dni : String(id));

/**
 * POST /auth/campus/session
 *
 * The widget relays the campus session cookie; we make our own request to
 * campus.ort.edu.ar to find out who owns it, resolve that to one of our
 * students, and mint a token. Nothing the client asserts about its identity is
 * trusted.
 */
export async function startCampusSession(
  request: Request<
    {},
    {},
    { cookie?: unknown; course?: unknown; year?: unknown }
  >,
  response: Response,
) {
  const year = Number(request.body.year);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return response
      .status(400)
      .send({ message: "Invalid year", reason: "invalidRequest" });
  }

  const cookieHeader = sanitizeCampusCookie(request.body.cookie);
  if (!cookieHeader) {
    return response
      .status(400)
      .send({ message: "Missing or malformed campus cookie", reason: "invalidCookie" });
  }

  const identity = await fetchLoggedInData(cookieHeader);
  if (!identity) {
    return response.status(401).send({
      message: "No active campus session for the supplied cookie",
      reason: "notLoggedIn",
    });
  }

  const course =
    typeof request.body.course === "string" && request.body.course.length > 0
      ? request.body.course
      : undefined;

  const match = await resolveStudent({
    campusId: identity.campusId,
    givenNames: identity.givenNames,
    surname: identity.surname,
    course,
    year,
  });

  if (match.status === "notFound") {
    return response.status(404).send({
      message: "No student matched the campus identity",
      reason: "noMatch",
    });
  }

  if (match.status === "ambiguous") {
    // Logged so the mismatch can be fixed by editing the student's name via
    // PATCH /students/:studentId — otherwise this failure is invisible.
    console.warn(
      "[campus-session] ambiguous identity",
      JSON.stringify({
        tier: match.tier,
        givenNames: identity.givenNames,
        surname: identity.surname,
        course,
        year,
        candidateIds: match.candidateIds,
      }),
    );
    return response.status(409).send({
      message: "Campus identity matched more than one student",
      reason: "ambiguous",
    });
  }

  const { student, tier } = match;
  await backfillCampusId(student.id, identity.campusId, tier);

  const payload: StudentTokenPayload = {
    typ: "student",
    sub: student.id,
    dni: student.dni,
    publicId: publicStudentId(year, student.id, student.dni),
    role: "STUDENT",
    name: student.name,
    surname: student.surname,
    course: student.course,
    year,
    src: "campus",
  };
  const token = signStudentToken(payload, CAMPUS_TOKEN_TTL_SECONDS);
  setStudentCookie(response, token, CAMPUS_TOKEN_TTL_SECONDS);

  // No setCacheHeaders here: controllers/shared.ts emits `public`, which on a
  // per-student credentialed response would let a CDN serve one student's
  // identity to another.
  return response.status(200).send({
    token,
    student: {
      id: publicStudentId(year, student.id, student.dni),
      name: student.name,
      surname: student.surname,
      course: student.course,
    },
  });
}

/** DELETE /auth/campus/session — drops the cookie (logout / stop impersonating). */
export function endStudentSession(_request: Request, response: Response) {
  clearStudentCookie(response);
  return response.sendStatus(204);
}

/**
 * POST /auth/impersonate
 *
 * Replaces the old client-side impersonation, where a teacher simply wrote a
 * student id into a persisted Alpine store and every downstream call took it on
 * trust. Now the backend authorises the pairing and mints a scoped, audited,
 * short-lived token.
 */
export async function impersonateStudent(
  request: Request<
    {},
    {},
    { studentId?: unknown; course?: unknown; year?: unknown }
  >,
  response: Response,
) {
  const actor = request.user as { id: number; role: Role } | undefined;
  if (!actor) {
    return response.status(401).send({ message: "Unauthorized" });
  }

  const studentId = Number(request.body.studentId);
  const year = Number(request.body.year);
  if (!Number.isInteger(studentId) || studentId <= 0) {
    return response.status(400).send({ message: "Invalid student id" });
  }
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return response.status(400).send({ message: "Invalid year" });
  }
  const requestedCourse =
    typeof request.body.course === "string" ? request.body.course : undefined;

  const student = await prisma.user.findFirst({
    where: { id: studentId, role: Role.STUDENT },
    select: {
      id: true,
      name: true,
      surname: true,
      dni: true,
      studentCourses: {
        where: { course: { year } },
        select: { course: { select: { name: true } } },
      },
    },
  });

  if (!student || student.studentCourses.length === 0) {
    return response
      .status(404)
      .send({ message: "Student not enrolled in that year" });
  }

  const enrolledCourses = student.studentCourses.map(
    (studentCourse) => studentCourse.course.name,
  );
  const course =
    requestedCourse && enrolledCourses.includes(requestedCourse)
      ? requestedCourse
      : enrolledCourses[0]!;

  if (actor.role === Role.TEACHER) {
    const teaches = await prisma.teacherOffering.findFirst({
      where: {
        teacherId: actor.id,
        offering: {
          year,
          offeringCourses: {
            some: {
              course: { year, students: { some: { studentId: student.id } } },
            },
          },
        },
      },
      select: { id: true },
    });
    if (!teaches) {
      return response
        .status(403)
        .send({ message: "You do not teach this student" });
    }
  }

  const payload: StudentTokenPayload = {
    typ: "student",
    sub: student.id,
    dni: student.dni,
    publicId: publicStudentId(year, student.id, student.dni),
    role: "STUDENT",
    name: student.name,
    surname: student.surname,
    course,
    year,
    src: "impersonation",
    act: { id: actor.id, role: actor.role },
  };
  const token = signStudentToken(payload, IMPERSONATION_TOKEN_TTL_SECONDS);
  setStudentCookie(response, token, IMPERSONATION_TOKEN_TTL_SECONDS);

  return response.status(200).send({
    token,
    student: {
      id: publicStudentId(year, student.id, student.dni),
      name: student.name,
      surname: student.surname,
      course,
    },
  });
}
