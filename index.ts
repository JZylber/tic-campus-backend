import "./loadEnv.ts";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import authRoute from "./routes/authRoute.ts";
import studentSessionRoute from "./routes/auth/studentSession.ts";
import userRoute from "./routes/student/userInfo.ts";
import studentsRoute from "./routes/student/students.ts";
import teachersRoute from "./routes/teacher/teachers.ts";
import marksRoute from "./routes/student/marks.ts";
import subjectsRoute from "./routes/subject/subjects.ts";
import articlesRoute from "./routes/subject/articles.ts";
import materialRoute from "./routes/subject/material.ts";
import linksRoute from "./routes/subject/links.ts";
import revisionRequestsRoute from "./routes/revision/revisionRequests.ts";
import revisionRequestRoute from "./routes/revision/revisionRequest.ts";
import calendarRoute from "./routes/project/calendar.ts";
import coursesRoute from "./routes/course/courses.ts";
import offeringTimeSlotsRoute from "./routes/offering/timeSlots.ts";
import offeringsRoute from "./routes/offering/offerings.ts";
import avanzadosRoute from "./routes/avanzado/avanzados.ts";

const app = express();
const PORT = process.env.PORT;

app.use(express.json());
// Unsigned on purpose: the only cookie we set holds a JWT already signed with
// JWT_SECRET, so a second cookie-signing secret would add a moving part and no
// security. See auth/studentJwt.ts.
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

app.use("/auth",             authRoute);
app.use("/auth",             studentSessionRoute);
app.use("/user",             userRoute);
app.use("/students",         studentsRoute);
app.use("/teachers",         teachersRoute);
app.use("/marks",            marksRoute);
app.use("/subjects",         subjectsRoute);
app.use("/articles",         articlesRoute);
app.use("/material",         materialRoute);
app.use("/links",            linksRoute);
app.use("/revisionRequests", revisionRequestsRoute);
app.use("/revisionRequest",  revisionRequestRoute);
app.use("/calendar",         calendarRoute);
app.use("/courses",          coursesRoute);
app.use("/offerings",        offeringTimeSlotsRoute);
app.use("/offerings",        offeringsRoute);
app.use("/avanzados",        avanzadosRoute);

app
  .listen(PORT, () => {
    console.log("Server running at PORT: ", PORT);
  })
  .on("error", (error) => {
    throw new Error(error.message);
  });
