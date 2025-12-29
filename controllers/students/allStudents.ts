import type { Request, Response } from "express";
import { getSheetClient } from "../../connectors/google.ts";
import { asTableData, setCacheHeaders } from "../shared.ts";
import type { StudentCourseTable, StudentTable } from "../subjectSchema.ts";

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
  const APIrequest = await sheetsAPI.spreadsheets.values.batchGet({
    spreadsheetId: process.env.MAIN_SPREADSHEET_ID!,
    ranges: ["Estudiantes!A:E", "EstudianteXCurso!A:E"],
  });
  const [studentsRes, studentsCourseRes] = APIrequest.data.valueRanges!;
  const studentsData = asTableData(studentsRes!.values!) as StudentTable;
  const studentsCourseData = asTableData(
    studentsCourseRes!.values!
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
  // Set Cache Control, CDN-Cache-Control and Vercel-CDN-Cache-Control to 1 hour
  setCacheHeaders(response, 3600);
  return response.status(200).send(students);
}
