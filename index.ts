import express from "express";
import dotenv from "dotenv";
import { getStudentData } from "./controllers/students/auth.ts";
import { getSubjectArticles } from "./controllers/subjects/articles.ts";
import cors from "cors";
import cookieParser from "cookie-parser";
import { getHomeLinks, getRedoLinks } from "./controllers/subjects/links.ts";
import {
  getAllSubjects,
  getSubjectStudents,
  getTemplateSubjects,
} from "./controllers/subjects/allSubjects.ts";
import { getSubjectMaterials } from "./controllers/subjects/material.ts";
import { getAllStudents } from "./controllers/students/allStudents.ts";
import {
  getRevisionRequests,
  getStudentMarks,
} from "./controllers/students/marks.ts";
import { getCalendar } from "./controllers/project/calendar.ts";
import {
  getRevisionRequestsByTeacher,
  requestRevision,
} from "./controllers/subjects/revision.ts";

import authRoute from "./routes/authRoute.ts"; // our authRoute
import userRoute from "./routes/student/mockUser.ts"; // our userRoute

// configures dotenv to work in your application
dotenv.config();
// setup google credentials

const app = express();
const PORT = process.env.PORT;

app.use(express.json());
app.use(cookieParser());

const toOrigin = (url: string | undefined): string | null => {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
};

const allowedOrigins = [
  toOrigin(process.env.FE_BASE_URL),
  toOrigin(process.env.FE_EMBED_URL),
].filter((origin): origin is string => Boolean(origin));

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, origin);
      return cb(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
  }),
);

app.get("/", (req, res) => {
  res.send("TIC Campus Backend is running.");
});

// Auth
app.use("/auth", authRoute);
app.use("/user", userRoute);

// Students
app.get("/students", getAllStudents);
app.get("/students/:subject/:course/:year", getSubjectStudents);
app.post("/student", getStudentData);
app.get("/marks/:subject/:course/:year/:id", getStudentMarks);

// Subjects
app.get("/subjects", getAllSubjects);
app.get("/subjects/:templateId", getTemplateSubjects);
app.get("/articles/:subject/:course/:year", getSubjectArticles);
app.get("/material/:subject/:course/:year", getSubjectMaterials);
app.get("/homeLinks/:subject/:course/:year", getHomeLinks);
app.get("/redoLinks/:subject/:course/:year", getRedoLinks);

// Revisions
app.get("/revisionRequests/:subject/:course/:year/:id", getRevisionRequests);
app.get(
  "/revisionRequests/teacher/:year/:teacherId",
  getRevisionRequestsByTeacher,
);
app.post("/revisionRequest", requestRevision);

// Project
app.get("/calendar/:subject/:course/:year", getCalendar);

app
  .listen(PORT, () => {
    console.log("Server running at PORT: ", PORT);
  })
  .on("error", (error) => {
    // gracefully handle error
    throw new Error(error.message);
  });
