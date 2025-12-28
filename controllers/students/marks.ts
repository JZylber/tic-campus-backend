import type { Request, Response } from "express";
import { getSheetClient, getSpreadsheetId } from "../../connectors/google.ts";
import { asTableData } from "../shared.ts";
import type {
  MarksTable,
  ActivitiesTable,
  RedosTable,
  SubjectTable,
  ContentsTable,
  RedoRequestsTable,
} from "../subjectSchema.ts";

interface Activity {
  studentId: string;
  name: string;
  id: string;
  comment: string;
  visible: boolean;
}

interface ClassActivity extends Activity {
  done: boolean;
}

interface MarkedActivity extends Activity {
  mark: number;
}

interface RedoActivity extends MarkedActivity {
  coveredActivities: string[];
}

async function getMarksAndCriteria(subject: string, dataSheetId: string) {
  const sheets = await getSheetClient();
  // Fetch Marks
  const marksPromise = sheets.spreadsheets.values.get({
    spreadsheetId: dataSheetId,
    range: "Nota!A:J",
  });
  // Fetch Activitites
  const activitiesPromise = sheets.spreadsheets.values.get({
    spreadsheetId: dataSheetId,
    range: "Actividad!A:J",
  });
  // Fetch Redos
  const redosPromise = sheets.spreadsheets.values.get({
    spreadsheetId: dataSheetId,
    range: "Recuperatorio!A:J",
  });
  // Fetch Criteria
  const subjectPromise = sheets.spreadsheets.values.get({
    spreadsheetId: dataSheetId,
    range: "Materia!A:G",
  });
  // Fetch Activities
  const contentsPromise = sheets.spreadsheets.values.get({
    spreadsheetId: dataSheetId,
    range: "Contenidos!A:H",
  });
  const [marksRes, activitiesRes, redosRes, subjectRes, contentsRes] =
    await Promise.all([
      marksPromise,
      activitiesPromise,
      redosPromise,
      subjectPromise,
      contentsPromise,
    ]);
  const marksData = asTableData(marksRes.data.values!) as MarksTable;
  const activitiesData = asTableData(
    activitiesRes.data.values!
  ) as ActivitiesTable;
  const redosData = asTableData(redosRes.data.values!) as RedosTable;
  const subjectData = asTableData(subjectRes.data.values!) as SubjectTable;
  const contentsData = asTableData(contentsRes.data.values!) as ContentsTable;
  // Get criteria from subjectData
  const currentSubject = subjectData.find((s) => s.Materia === subject);
  const criteria = {
    proportion:
      parseInt(currentSubject!["Proporci\u00F3n TPS/Nota"].replace("%", "")) /
      100,
    specialActivities: currentSubject!["Actividades Especiales"]
      .split(",")
      .map((a) => a.trim()),
  };
  // Get all content Ids and names that belong to this subject
  const subjectContent = contentsData
    .filter((c) => c.Materia === subject)
    .map((c) => ({ Id: c.Id, Nombre: c.Nombre }));
  // Convert activitiesData to ClassActivity[]. Filter by subjectContentIds.
  const classActivities: ClassActivity[] = activitiesData
    .map((activity) => ({
      studentId: activity["Id Estudiante"],
      name: activity["Nombre Actividad"],
      id: activity["Id Actividad"],
      comment: activity.Aclaración,
      done: activity.Realizada.toLowerCase() === "true",
      visible: activity.Visible.toLowerCase() === "true",
    }))
    .filter((activity) =>
      subjectContent.some((content) => content.Id === activity.id)
    );
  // Convert marksData to MarkedActivity[]. Filter by subjectContentIds.
  const markedActivities: MarkedActivity[] = marksData
    .map((mark) => ({
      studentId: mark["Id Estudiante"],
      name: mark["Nombre Actividad"],
      id: mark["Id Actividad"],
      comment: mark.Aclaración,
      mark: parseFloat(mark.Nota.replace(",", ".")),
      visible: mark.Visible.toLowerCase() === "true",
    }))
    .filter((activity) =>
      subjectContent.some((content) => content.Id === activity.id)
    );
  // Convert redosData to RedoActivity[]. Filter by subjectContentIds.
  const redoActivities: RedoActivity[] = redosData
    .map((redo) => ({
      studentId: redo["Id Estudiante"],
      name: redo["Nombre Recuperatorio"],
      id: redo.Id,
      comment: redo.Aclaración,
      mark: parseFloat(redo.Nota.replace(",", ".")),
      coveredActivities: redo["Id Actividad"].split(",").map((a) => a.trim()),
      visible: redo.Visible.toLowerCase() === "true",
    }))
    .filter((activity) =>
      activity.coveredActivities.every((id) =>
        subjectContent.some((content) => content.Id === id)
      )
    );
  return { classActivities, markedActivities, redoActivities, criteria };
}

export async function getStudentMarks(
  request: Request<
    { subject: string; course: string; year: string; id: string },
    {},
    {},
    { dataSheetId?: string }
  >,
  response: Response
) {
  // Get parameters from request parameters
  const { subject, course, year, id } = request.params;
  let spreadsheetId = request.query.dataSheetId || "";
  if (!spreadsheetId) {
    try {
      spreadsheetId = await getSpreadsheetId(subject, course, Number(year));
    } catch (error) {
      return response.status(404).send({ error: (error as Error).message });
    }
  }
  const { classActivities, markedActivities, redoActivities, criteria } =
    await getMarksAndCriteria(subject, spreadsheetId);
  // Filter activities by student ID and visibility
  const studentClassActivities = classActivities.filter(
    (activity) => activity.studentId === id && activity.visible
  );
  const studentMarkedActivities = markedActivities.filter(
    (activity) => activity.studentId === id && activity.visible
  );
  const studentRedoActivities = redoActivities.filter(
    (activity) => activity.studentId === id && activity.visible
  );
  return response.status(200).send({
    classActivities: studentClassActivities,
    markedActivities: studentMarkedActivities,
    redoActivities: studentRedoActivities,
    criteria,
  });
}

export async function getRevisionRequests(
  request: Request<
    { course: string; year: string; subject: string },
    {},
    {},
    { dataSheetId?: string; name?: string; surname?: string }
  >,
  response: Response
) {
  const { subject, course, year } = request.params;
  const { name = "", surname = "", dataSheetId = "" } = request.query;
  let spreadsheetId = dataSheetId;
  if (!spreadsheetId) {
    try {
      spreadsheetId = await getSpreadsheetId(subject, course, Number(year));
    } catch (error) {
      return response.status(404).send({ error: (error as Error).message });
    }
  }
  // Level is derived from Curso: "NR3A" -> 3, "NR5C" -> 5, etc.
  const level = Number(course.match(/\d+/)?.[0] || 0);
  const sheets = await getSheetClient();
  // Get Reentrega A{level} and Reentrega N{level} sheets
  const redoRequestsPromise = sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `Reentrega A${level}!A:F`,
  });
  const redoRequestsNPromise = sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `Reentrega N${level}!A:F`,
  });
  // Promises can fail independently if the sheets don't exist
  const [redoRequestsRes, redoRequestsNRes] = await Promise.allSettled([
    redoRequestsPromise,
    redoRequestsNPromise,
  ]);
  let redoRequestsData: RedoRequestsTable = [];
  if (redoRequestsRes.status === "fulfilled") {
    redoRequestsData = redoRequestsData.concat(
      asTableData(redoRequestsRes.value.data.values!) as RedoRequestsTable
    );
  }
  if (redoRequestsNRes.status === "fulfilled") {
    redoRequestsData = redoRequestsData.concat(
      asTableData(redoRequestsNRes.value.data.values!) as RedoRequestsTable
    );
  }
  // Filter those requests that are not reviewed and match name and surname to any of the members in "Integrantes". Format of "Integrantes" is "Surname - Name, Surname - Name, ..."
  const pendingRequests = redoRequestsData.filter((request) => {
    if (request.Revisado.toLowerCase() === "true") return false;
    if (!name || !surname) return true;
    const integrantes = request.Integrantes.split(",").map((member) =>
      member.trim().toLowerCase()
    );
    const fullName = `${surname} - ${name}`.toLowerCase();
    return integrantes.includes(fullName);
  });
  // Get only ids of pending requests
  const pendingRequestIds = pendingRequests.map(
    (request) => request["Id Actividad"]
  );
  return response.status(200).send(pendingRequestIds);
}
