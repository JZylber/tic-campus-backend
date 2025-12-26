import express from "express";
import dotenv from "dotenv";
import { getStudentData } from "./controllers/students.ts";
import { getSubjectArticles } from "./controllers/subjects/articles.ts";
import cors from "cors";
import { getHomeLinks } from "./controllers/subjects/homelinks.ts";
// configures dotenv to work in your application
dotenv.config();
// setup google credentials

const app = express();

const PORT = process.env.PORT;

app.use(express.json());

app.use(cors());

// Students
app.post("/student", getStudentData);

// Subjects
app.get("/articles/:subject/:course/:year", getSubjectArticles);
app.get("/homeLinks/:subject/:course/:year", getHomeLinks);

app
  .listen(PORT, () => {
    console.log("Server running at PORT: ", PORT);
  })
  .on("error", (error) => {
    // gracefully handle error
    throw new Error(error.message);
  });
