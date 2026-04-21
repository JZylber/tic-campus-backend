import type { Request, Response } from "express";
import { getSheetClient, getSpreadsheetId } from "../../connectors/google.ts";
import { asTableData, setCacheHeaders } from "../shared.ts";
import type {
  MarksTable,
  ActivitiesTable,
  RedosTable,
  SubjectTable,
  ContentsTable,
  FixedMarksTable,
} from "../subjectSchema.ts";
import prisma from "../../prisma/prisma.ts";

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

type FixedMarkRecord = {
  studentId: string;
  type: string;
  mark: string;
  observation?: string;
  suggestion?: string;
  visible: boolean;
};

type FixedMarks = Record<
  string,
  | {
      mark: string;
      observation: string | undefined;
      suggestion: string | undefined;
    }
  | undefined
>;

async function getMarksAndCriteria(subject: string, dataSheetId: string) {
  const sheets = await getSheetClient();
  const APIrequest = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: dataSheetId,
    ranges: [
      "Nota!A:J",
      "Actividad!A:J",
      "Recuperatorio!A:J",
      "Materia!A:G",
      "Contenidos!A:H",
      "Notas Fijas!A:H",
    ],
  });
  const [
    marksRes,
    activitiesRes,
    redosRes,
    subjectRes,
    contentsRes,
    fixedMarksRes,
  ] = APIrequest.data.valueRanges!;
  const marksData = asTableData(marksRes!.values!) as MarksTable;
  const activitiesData = asTableData(activitiesRes!.values!) as ActivitiesTable;
  const redosData = asTableData(redosRes!.values!) as RedosTable;
  const subjectData = asTableData(subjectRes!.values!) as SubjectTable;
  const contentsData = asTableData(contentsRes!.values!) as ContentsTable;
  const fixedMarksData = asTableData(fixedMarksRes!.values!) as FixedMarksTable;
  // Get criteria from subjectData
  const currentSubject = subjectData.find((s) => s.Materia === subject);
  const criteria = {
    proportion:
      parseInt(currentSubject!["Proporci\u00F3n TPS/Nota"].replace("%", "")) /
      100,
    specialActivities: currentSubject!["Actividades Especiales"]
      ? currentSubject!["Actividades Especiales"]
          .split(",")
          .map((a) => a.trim())
      : [],
  };
  // Get all content Ids and names that belong to this subject
  const subjectContent = contentsData
    .filter((c) => c.Materia === subject)
    .map((c) => ({ Id: c.Id, Nombre: c.Nombre }));
  // Convert activitiesData to ClassActivity[]. Filter by subjectContentIds.
  const classActivities: ClassActivity[] = activitiesData
    .filter(
      (activity) =>
        activity["Id Estudiante"] !== "" && activity["Id Actividad"] !== "",
    )
    .map((activity) => {
      return {
        studentId: activity["Id Estudiante"],
        name: activity["Nombre Actividad"],
        id: activity["Id Actividad"],
        comment: activity.Aclaración,
        done: activity.Realizada
          ? activity.Realizada.toLowerCase() === "true"
          : false,
        visible: activity.Visible
          ? activity.Visible.toLowerCase() === "true"
          : false,
      };
    })
    .filter((activity) =>
      subjectContent.some((content) => content.Id === activity.id),
    );
  // Convert marksData to MarkedActivity[]. Filter by subjectContentIds.
  const markedActivities: MarkedActivity[] = marksData
    .filter(
      (mark) =>
        mark["Id Estudiante"] !== "" &&
        mark["Id Actividad"] !== "" &&
        mark.Nota,
    )
    .map((mark) => ({
      studentId: mark["Id Estudiante"],
      name: mark["Nombre Actividad"],
      id: mark["Id Actividad"],
      comment: mark.Aclaración,
      mark: parseFloat(mark.Nota.replace(",", ".")),
      visible: mark.Visible ? mark.Visible.toLowerCase() === "true" : false,
    }))
    .filter((activity) =>
      subjectContent.some((content) => content.Id === activity.id),
    );
  // Convert redosData to RedoActivity[]. Filter by subjectContentIds.
  const redoActivities: RedoActivity[] = redosData
    .filter(
      (redo) => redo["Id Estudiante"] !== "" && redo["Id Actividad"] !== "",
    )
    .map((redo) => ({
      studentId: redo["Id Estudiante"],
      name: redo["Nombre Recuperatorio"],
      id: redo.Id,
      comment: redo.Aclaración,
      mark: parseFloat(redo.Nota.replace(",", ".")),
      coveredActivities: redo["Id Actividad"].split(",").map((a) => a.trim()),
      visible: redo.Visible ? redo.Visible.toLowerCase() === "true" : false,
    }))
    .filter((activity) =>
      activity.coveredActivities.every((id) =>
        subjectContent.some((content) => content.Id === id),
      ),
    );
  // Get fixed marks for the subject
  const subjectFixedMarks = fixedMarksData.filter(
    (mark) =>
      mark.Materia === subject ||
      (!mark.Materia && mark["Id Estudiante"] !== ""),
  );
  // Some marks are Nota - Observación - Sugerencia
  const fixedMarks: FixedMarkRecord[] = subjectFixedMarks.map((mark) => {
    const valorParts = mark.Valor?.split(" - ").map((part) => part.trim()) || [
      "",
    ];
    return {
      studentId: mark["Id Estudiante"],
      type: mark.Tipo,
      mark: valorParts[0]!,
      observation: valorParts[1] || "",
      suggestion: valorParts[2] || "",
      visible: mark.Visible ? mark.Visible.toLowerCase() === "true" : false,
    };
  });
  return {
    classActivities,
    markedActivities,
    redoActivities,
    criteria,
    fixedMarks,
  };
}

export async function getStudentMarks(
  request: Request<
    { subject: string; course: string; year: string; id: string },
    {},
    {},
    { dataSheetId?: string }
  >,
  response: Response,
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
  const {
    classActivities,
    markedActivities,
    redoActivities,
    criteria,
    fixedMarks,
  } = await getMarksAndCriteria(subject, spreadsheetId);
  // Filter activities by student ID and visibility
  const studentClassActivities = classActivities.filter(
    (activity) => activity.studentId === id && activity.visible,
  );
  const studentMarkedActivities = markedActivities.filter(
    (activity) => activity.studentId === id && activity.visible,
  );
  const studentRedoActivities = redoActivities.filter(
    (activity) => activity.studentId === id && activity.visible,
  );
  const studentFixedMarks: FixedMarks = {};
  fixedMarks
    .filter((mark) => mark.studentId === id && mark.visible)
    .forEach((mark) => {
      studentFixedMarks[mark.type] = {
        mark: mark.mark,
        observation: mark.observation,
        suggestion: mark.suggestion,
      };
    });
  // Set Cache Control, CDN-Cache-Control and Vercel-CDN-Cache-Control to 100 seconds
  setCacheHeaders(response, 100);
  return response.status(200).send({
    classActivities: studentClassActivities,
    markedActivities: studentMarkedActivities,
    redoActivities: studentRedoActivities,
    criteria,
    fixedMarks: studentFixedMarks,
  });
}

export async function getRevisionRequests(
  request: Request<
    { course: string; year: string; subject: string; id: string },
    {},
    {},
    {}
  >,
  response: Response,
) {
  const { subject, course, year, id } = request.params;
  const pendingRequestIds = await prisma.revisionRequest
    .findMany({
      where: {
        reviewed: false,
        subject: {
          name: subject,
          course: {
            name: course,
            year: Number(year),
          },
        },
        studentId: parseInt(id),
      },
      select: {
        activityId: true,
      },
    })
    .then((revisionRequests) =>
      revisionRequests.map((request) => request.activityId.toString()),
    );
  setCacheHeaders(response, 100);
  return response.status(200).send(pendingRequestIds);
}

export async function getTeacherSubjects(
  request: Request<{ teacherId: string }, {}, {}, {}>,
  response: Response,
) {
  // Get all subjects taught by the teacher with their dataSheetId
  const { teacherId } = request.params;
  const subjects = await prisma.subject.findMany({
    where: {
      teacherSubjects: {
        some: {
          teacherId: parseInt(teacherId),
        },
      },
    },
    select: {
      name: true,
      course: {
        select: {
          name: true,
          year: true,
        },
      },
      spreadsheetId: true,
    },
  });
  setCacheHeaders(response, 100);
  // Flatten the data to include subject name, course name, year and dataSheetId
  const flattenedSubjects = subjects.map((subject) => ({
    name: subject.name,
    course: subject.course.name,
    year: subject.course.year,
    dataSheetId: subject.spreadsheetId,
  }));
  return response.status(200).send(flattenedSubjects);
}

export async function getMarksBySubject(
  request: Request<
    { subject: string; course: string; year: string },
    {},
    {},
    { dataSheetId?: string }
  >,
  response: Response,
) {
  const { subject, course, year } = request.params;
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
  // Group data by student ID
  const marksByStudent: Record<
    string,
    {
      classActivities: ClassActivity[];
      markedActivities: MarkedActivity[];
      redoActivities: RedoActivity[];
      name: string;
      surname: string;
    }
  > = {};
  const createEmptyRecordIfNotExists = (studentId: string) => {
    if (!marksByStudent[studentId]) {
      marksByStudent[studentId] = {
        classActivities: [],
        markedActivities: [],
        redoActivities: [],
        name: "", // This will be filled later with the student's name from the database
        surname: "",
      };
    }
  };
  // Get student names from the database and fill marksByStudent
  const students = await prisma.user.findMany({
    where: {
      studentCourses: {
        some: {
          course: {
            name: course,
            year: Number(year),
          },
        },
      },
    },
    select: {
      id: true,
      name: true,
      surname: true,
    },
  });
  students.forEach((student) => {
    createEmptyRecordIfNotExists(student.id.toString());
    marksByStudent[student.id.toString()]!.name = student.name!;
    marksByStudent[student.id.toString()]!.surname = student.surname!;
  });
  classActivities.forEach((activity) => {
    if(marksByStudent[activity.studentId] && activity.visible) {
      marksByStudent[activity.studentId]!.classActivities.push(activity);
    }
  });
  markedActivities.forEach((activity) => {
    if(marksByStudent[activity.studentId] && activity.visible) {
      marksByStudent[activity.studentId]!.markedActivities.push(activity);
    }
  });
  redoActivities.forEach((activity) => {
    if(marksByStudent[activity.studentId] && activity.visible) {
      marksByStudent[activity.studentId]!.redoActivities.push(activity);
    }
  });
  setCacheHeaders(response, 100);
  return response.status(200).send({ marksByStudent, criteria });
}
