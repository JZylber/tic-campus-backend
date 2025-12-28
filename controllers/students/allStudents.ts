import type { Request, Response } from "express";
import { getSheetClient } from "../../connectors/google.ts";
import { asTableData } from "../shared.ts";
import type { StudentCourseTable, StudentTable } from "./types.ts";

type Student = {
  id: string;
  name: string;
  surname: string;
  dni: string;
  email: string;
  year: number;
  course: string;
};

export async function getAllStudents(request: Request, response: Response) {
  const sheetsAPI = await getSheetClient();
  const studentsPromise = sheetsAPI.spreadsheets.values.get({
    spreadsheetId: process.env.MAIN_SPREADSHEET_ID!,
    range: "Estudiantes!A:E",
  });
  const studentsCoursePromise = sheetsAPI.spreadsheets.values.get({
    spreadsheetId: process.env.MAIN_SPREADSHEET_ID!,
    range: "EstudianteXCurso!A:E",
  });
  const [studentsRes, studentsCourseRes] = await Promise.all([
    studentsPromise,
    studentsCoursePromise,
  ]);
  const studentsData = asTableData(studentsRes.data.values!) as StudentTable;
  const studentsCourseData = asTableData(
    studentsCourseRes.data.values!
  ) as StudentCourseTable;
  // Merge studentsData into studentsCourseData on Id field as Student
  const students: Student[] = studentsCourseData.map((courseRow) => {
    const studentInfo = studentsData.find(
      (studentRow) => studentRow.Id === courseRow.Id
    );
    // If year is 2025, use DNI as student ID
    return {
      id:
        courseRow.Año === "2025" && studentInfo
          ? studentInfo.DNI
          : courseRow.Id,
      name: studentInfo ? studentInfo.Nombre : "",
      surname: studentInfo ? studentInfo.Apellido : "",
      dni: studentInfo ? studentInfo.DNI : "",
      email: studentInfo ? studentInfo.Mail : "",
      year: Number(courseRow.Año),
      course: courseRow.Curso,
    };
  });
  return response.status(200).send(students);
}
