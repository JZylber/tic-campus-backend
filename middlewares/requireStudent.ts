import type { NextFunction, Request, Response } from "express";
import passport from "../auth/passport.ts";
import type { StudentRequestUser } from "../auth/studentJwt.ts";

/**
 * Authenticates a student by the campus/impersonation token, from either the
 * ticCampusStudentToken cookie or the X-Student-Token header.
 */
const requireStudent = passport.authenticate("jwtStudent", { session: false });

/**
 * Asserts the student identifier in the route matches the authenticated
 * student. Accepts the DNI as well as our User.id because year-2025
 * spreadsheets key `Id Estudiante` on the DNI, so the archive pages request
 * marks by DNI.
 */
export const requireStudentSelf =
  (paramName: string) =>
  (request: Request, response: Response, next: NextFunction) => {
    const token = (request.user as StudentRequestUser | undefined)?.studentToken;
    const requested = request.params[paramName];
    if (!token || !requested) {
      return response.status(403).json({ message: "Forbidden" });
    }
    const isSelf =
      requested === String(token.sub) ||
      (token.dni !== null && requested === token.dni);
    if (!isSelf) {
      return response.status(403).json({ message: "Forbidden" });
    }
    return next();
  };

/**
 * "0" is the established sentinel for "no student identified" — the public
 * Proyecto timetable passes it so anonymous visitors still see the schedule,
 * just with nothing marked as enrolled (see fetchPublicOfferingSchedule on the
 * frontend). It carries no personal data, so it stays open; every other value
 * has to be the authenticated student.
 */
export const ANONYMOUS_STUDENT_ID = "0";

export const requireStudentSelfOrAnonymous =
  (paramName: string) =>
  (request: Request, response: Response, next: NextFunction) => {
    if (request.params[paramName] === ANONYMOUS_STUDENT_ID) return next();
    return requireStudent(request, response, (error?: unknown) => {
      if (error) return next(error);
      return requireStudentSelf(paramName)(request, response, next);
    });
  };

export default requireStudent;
