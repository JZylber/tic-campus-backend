import express, { type Request, type Response } from "express";
import dotenv from "dotenv";
import { getSheetClient, getSpreadsheetId } from "./connectors/google.ts";
import { getStudentId } from "./controllers/students.ts";

// configures dotenv to work in your application
dotenv.config();
const app = express();

const PORT = process.env.PORT;

app.use(express.json());

app.post("/student-id", getStudentId);

app
  .listen(PORT, () => {
    console.log("Server running at PORT: ", PORT);
  })
  .on("error", (error) => {
    // gracefully handle error
    throw new Error(error.message);
  });
