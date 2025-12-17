import type { Request, Response } from "express";

import { getSheetClient } from "../connectors/google.ts";
import Fuse from "fuse.js";

export async function getStudentId(
  request: Request<{}, {}, { name: string; surname: string }>,
  response: Response
) {
  const sheetsAPI = await getSheetClient();
  const studentCoursesPromise = sheetsAPI.spreadsheets.values.get({
    spreadsheetId: process.env.MAIN_SPREADSHEET_ID!,
    range: "EstudianteXCurso!A:E",
  });
  const studentsPromise = sheetsAPI.spreadsheets.values.get({
    spreadsheetId: process.env.MAIN_SPREADSHEET_ID!,
    range: "Estudiantes!A:E",
  });
  const [studentCoursesRes, studentsRes] = await Promise.all([
    studentCoursesPromise,
    studentsPromise,
  ]);
  const { name, surname } = request.body;
  const students = studentsRes.data.values?.map((row) => ({
    id: row[0],
    surname: row[3],
    name: row[4],
  }));
  const fuse = new Fuse(students!, {
    keys: ["name", "surname"],
    threshold: 0.4,
  });
  const possibleStudents = fuse.search({ name: name, surname: surname });
  if (possibleStudents.length === 0) {
    return response
      .status(404)
      .send({ message: "No student found with the given name and surname." });
  }
  const studentId = possibleStudents[0]!.item.id;
  const coursePerYear = studentCoursesRes.data.values
    ?.filter((row) => row[0] === studentId)
    .reduce((acc, row) => {
      acc[Number(row[3])] = row[4];
      return acc;
    }, {} as Record<number, string>);
  return response.status(200).send({ studentId, coursePerYear });
}
