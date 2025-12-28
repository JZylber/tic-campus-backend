import type { Request, Response } from "express";
import { getSheetClient, getSpreadsheetId } from "../../connectors/google.ts";
import { asTableData } from "../shared.ts";
import type {
  MarksTable,
  ActivitiesTable,
  RedosTable,
  SubjectTable,
  ContentsTable,
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
  // Get all content Ids that belong to this subject
  const subjectContentIds = contentsData
    .filter((c) => c.Materia === subject)
    .map((c) => c.Id);
  // Convert activitiesData to ClassActivity[]. Filter by subjectContentIds.
  const classActivities: ClassActivity[] = activitiesData
    .map((activity) => ({
      studentId: activity["Id Estudiante"],
      name: activity.Nombre,
      id: activity["Id Actividad"],
      comment: activity.Aclaración,
      done: activity.Realizada.toLowerCase() === "true",
      visible: activity.Visible.toLowerCase() === "true",
    }))
    .filter((activity) => subjectContentIds.includes(activity.id));
  // Convert marksData to MarkedActivity[]. Filter by subjectContentIds.
  const markedActivities: MarkedActivity[] = marksData
    .map((mark) => ({
      studentId: mark["Id Estudiante"],
      name: mark.Nombre,
      id: mark["Id Actividad"],
      comment: mark.Aclaración,
      mark: parseFloat(mark.Nota.replace(",", ".")),
      visible: mark.Visible.toLowerCase() === "true",
    }))
    .filter((activity) => subjectContentIds.includes(activity.id));
  // Convert redosData to RedoActivity[]. Filter by subjectContentIds.
  const redoActivities: RedoActivity[] = redosData
    .map((redo) => ({
      studentId: redo["Id Estudiante"],
      name: redo.Nombre,
      id: redo.Id,
      comment: redo.Aclaración,
      mark: parseFloat(redo.Nota.replace(",", ".")),
      coveredActivities: redo["Id Actividad"].split(",").map((a) => a.trim()),
      visible: redo.Visible.toLowerCase() === "true",
    }))
    .filter((activity) =>
      activity.coveredActivities.every((id) => subjectContentIds.includes(id))
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
