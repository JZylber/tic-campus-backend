import type { Request, Response } from "express";
import { getSheetClient, getSpreadsheetId } from "../../connectors/google.ts";
import { asTableData } from "../shared.ts";

export enum ContentType {
  activity = "Actividad",
  material = "Material",
  finalActivity = "Trabajo Práctico",
  survey = "Encuesta",
  makeup = "Recuperatorio",
}

export type Content = {
  id: string;
  name: string;
  topic: string;
  type: ContentType;
  unit: string;
  imgURL: string;
  textURL: string;
  handInURL: string;
  repositoryURL: string;
  tutorURL: string;
  latest: boolean;
  optional: boolean;
};

export type Unit = {
  name: string;
  order: number;
  contents: Array<Content>;
};

export type ContentsPerCourseTable = Array<{
  Id: string;
  "Id Contenido": string;
  Nombre: string;
  Contenido: string;
  CursoXMateria: string;
  Curso: string;
  Materia: string;
  Visible: string;
  "En Curso": string;
  Opcional: string;
  Entrega: string;
  Repositorio: string;
  Tutor: string;
}>;

export type ContentsTable = Array<{
  Id: string;
  Tipo: string;
  Nombre: string;
  Tema: string;
  Unidad: string;
  Materia: string;
  Texto: string;
  Imagen: string;
}>;

export type UnitsTable = Array<{
  Id: string;
  "Id Materia": string;
  Nombre: string;
  Orden: string;
}>;

export async function getSubjectArticles(
  request: Request<{ subject: string; course: string; year: string }>,
  response: Response
) {
  // Get parameters from request parameters
  const { subject, course, year } = request.params;
  let spreadsheetId = await getSpreadsheetId(subject, course, Number(year));
  const sheets = await getSheetClient();
  const unitsPromise = sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Unidades!A:D",
  });
  const contentsPromise = sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Contenidos!A:H",
  });
  const contentsPerCoursePromise = sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "ContenidosXCurso!A:L",
  });
  // Map responses with asTableData function
  const [unitsRes, contentsRes, contentsPerCourseRes] = (
    await Promise.all([unitsPromise, contentsPromise, contentsPerCoursePromise])
  ).map((res) => asTableData(res.data.values!));
  // Type the mapped responses
  const units = unitsRes as UnitsTable;
  const contents = contentsRes as ContentsTable;
  const contentsPerCourse = contentsPerCourseRes as ContentsPerCourseTable;
  // Filter contents that are visible in the course and subject
  const visibleSubjectContents = contentsPerCourse.filter(
    (content) =>
      content.Visible === "TRUE" &&
      content.Curso === course &&
      (!content.Materia || content.Materia === subject)
  );
  // Build an array of units by reducing the visible contents
  const subjectUnits: Array<Unit> = visibleSubjectContents.reduce(
    (unitsAcc, contentPerCourse) => {
      // Find the content details
      const contentDetails = contents.find(
        (content) => content.Id === contentPerCourse["Id Contenido"]
      );
      if (!contentDetails) return unitsAcc;
      // Find if the unit already exists in the accumulator
      let unit = unitsAcc.find((unit) => unit.name === contentDetails.Unidad);
      // If not, create it and add to the accumulator
      if (!unit) {
        const unitDetails = units.find(
          (u) => u.Nombre === contentDetails.Unidad
        );
        unit = {
          name: contentDetails.Unidad,
          order: unitDetails ? Number(unitDetails.Orden) : 0,
          contents: [],
        };
        unitsAcc.push(unit);
      }
      // Add the content to the unit's contents
      unit.contents.push({
        id: contentDetails.Id,
        name: contentDetails.Nombre,
        topic: contentDetails.Tema,
        type: contentDetails.Tipo as any,
        unit: contentDetails.Unidad,
        imgURL: contentDetails.Imagen,
        textURL: contentDetails.Texto,
        handInURL: contentPerCourse.Entrega,
        repositoryURL: contentPerCourse.Repositorio,
        tutorURL: contentPerCourse.Tutor,
        latest: contentPerCourse["En Curso"] === "TRUE",
        optional: contentPerCourse.Opcional === "TRUE",
      });
      return unitsAcc;
    },
    [] as Array<Unit>
  );
  // Sort units by order
  subjectUnits.sort((a, b) => a.order - b.order);
  return response.status(200).send(subjectUnits);
}
