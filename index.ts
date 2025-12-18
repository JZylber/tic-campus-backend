import express from "express";
import dotenv from "dotenv";
import { getStudentData } from "./controllers/students.ts";
import { setGoogleCredentials } from "./connectors/google.ts";

// configures dotenv to work in your application
dotenv.config();
// setup google credentials
await setGoogleCredentials();

const app = express();

const PORT = process.env.PORT;

app.use(express.json());

app.post("/student", getStudentData);

app
  .listen(PORT, () => {
    console.log("Server running at PORT: ", PORT);
  })
  .on("error", (error) => {
    // gracefully handle error
    throw new Error(error.message);
  });
