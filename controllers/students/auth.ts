import type { Request, Response } from "express";

import { getSheetClient } from "../../connectors/google.ts";
import Fuse from "fuse.js";
import { getColumnIndex, setCacheHeaders } from "../shared.ts";

export async function getStudentData(
  request: Request<{}, {}, { name: string; surname: string; year: number }>,
  response: Response
) {
  const sheetsAPI = await getSheetClient();
  const APIrequest = await sheetsAPI.spreadsheets.values.batchGet({
    spreadsheetId: process.env.MAIN_SPREADSHEET_ID!,
    ranges: ["EstudianteXCurso!A:E", "Estudiantes!A:E"],
  });
  const [studentCoursesRes, studentsRes] = APIrequest.data.valueRanges!;
  const { name, surname, year } = request.body;
  const rowHeaders: string[] = studentsRes!.values?.shift() || [];
  const students = studentsRes!.values?.map((row) => ({
    id: row[getColumnIndex("Id", rowHeaders)],
    dni: row[getColumnIndex("DNI", rowHeaders)],
    mail: row[getColumnIndex("Mail", rowHeaders)],
    surname: row[getColumnIndex("Apellido", rowHeaders)],
    name: row[getColumnIndex("Nombre", rowHeaders)],
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
  let studentId = possibleStudents[0]!.item.id;
  const currentCourse = studentCoursesRes!.values?.find(
    (row) => row[0] === studentId && Number(row[3]) === year
  )?.[4];
  // IF year is 2025, use DNI as student ID
  if (year === 2025) {
    studentId = possibleStudents[0]!.item.dni.toString();
  }
  // Set cache headers for 1 hour
  setCacheHeaders(response, 3600);
  return response.status(200).send({ id: studentId, course: currentCourse });
}
