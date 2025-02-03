import express from "express";
import { connectDB } from "./dbConnect.js";
import userRouter from "./routes/users.js";
import receiptionRouter from "./routes/reception.js";
import doctorRouter from "./routes/doctor.js";
import patientRouter from "./routes/patient.js";
import puppeteer from "puppeteer";
import nurseRouter from "./routes/nurse.js";
import cors from "cors";
import labRouter from "./routes/lab.js";
import { getPatientHistory } from "./controllers/doctorController.js";
import { getFcmToken } from "./controllers/notifyController.js";
import { auth } from "./middleware/auth.js";
import { Server } from "socket.io";
import http from "http";
import { socketHandler } from "./socketHandler.js";
import fs from "fs";
const port = 3000;

const app = express();
const server = http.createServer(app);

app.use(express.json());
app.use(cors());
connectDB();
app.use("/users", userRouter);
app.use("/patient", patientRouter);
app.use("/reception", receiptionRouter);
app.use("/doctors", doctorRouter);
app.use("/nurse", nurseRouter);
app.use("/labs", labRouter);
app.get("/patientHistory/:patientId", getPatientHistory);

app.get("/", (req, res) => {
  return res.status(200).json("Welcome to Ai in HealthCare");
});
app.post("/generateDischargeSummary", async (req, res) => {
  const patientData = req.body; // Patient details sent from Flutter

  // Generate the discharge summary HTML content
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Discharge Summary</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 0; display: flex; justify-content: center; }
        .container { width: 210mm; height: 255mm; padding: 20mm; box-sizing: border-box; border: 1px solid #000; }
        .header { text-align: center; margin-bottom: 20px; }
        .footer { font-size: 12px; margin-top: 20px; text-align: center; border-top: 1px solid #000; padding-top: 10px; }
        .content { font-size: 14px; line-height: 1.6; }
        .section { margin-bottom: 20px; }
        .section h3 { font-size: 16px; font-weight: bold; margin-bottom: 10px; }
        .field { margin-bottom: 5px; }
        .field span { font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Discharge Summary</h1>
        </div>

        <div class="content">
          <div class="section">
            <h3>Patient Information</h3>
            <p class="field"><span>Name:</span> ${patientData.name}</p>
            <p class="field"><span>Age:</span> ${patientData.age} Years &nbsp;&nbsp;&nbsp; <span>Gender:</span> ${patientData.gender}</p>
            <p class="field"><span>Contact:</span> ${patientData.contact}</p>
            <p class="field"><span>Address:</span> ${patientData.address}</p>
          </div>

          <div class="section">
            <h3>Admission and Discharge Details</h3>
            <p class="field"><span>Admission Date:</span> ${patientData.admissionDate}</p>
            <p class="field"><span>Discharge Date:</span> ${patientData.dischargeDate}</p>
          </div>

          <div class="section">
            <h3>Diagnosis</h3>
            <p class="field"><span>Diagnosis:</span> ${patientData.diagnosis}</p>
          </div>
        </div>

        <div class="footer">
          Generated by the Hospital Management System
        </div>
      </div>
    </body>
    </html>
  `;
  console.log(patientData.name);
  try {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    // Set the HTML content
    await page.setContent(htmlContent);

    // Generate PDF from the HTML
    const pdfBuffer = await page.pdf({ format: "A4" });

    // Close the browser
    await browser.close();

    // Send the PDF file back to the client
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=discharge_summary.pdf"
    );
    res.send(pdfBuffer);
  } catch (error) {
    console.error("Error generating PDF:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
const predefinedLocation = {
  latitude: 19.215696,
  longitude: 73.0804656,
};

app.post("/check-location", (req, res) => {
  const { latitude, longitude } = req.body;

  // Calculate if the given coordinates are close enough to the predefined location
  const isInLocation =
    Math.abs(predefinedLocation.latitude - latitude) < 0.0001 &&
    Math.abs(predefinedLocation.longitude - longitude) < 0.0001;

  if (isInLocation) {
    res.json({ message: "You are in the right location!" });
  } else {
    res.json({ message: "You are not in the correct location." });
  }
});
app.post("/storeFcmToken", auth, getFcmToken);
socketHandler(server);
let medicines = {};
fs.readFile("./test.json", "utf8", (err, data) => {
  if (err) {
    console.error("Error reading JSON file:", err);
    return;
  }
  medicines = JSON.parse(data);
});

// Endpoint for search suggestions
app.get("/search", (req, res) => {
  const query = req.query.q?.toLowerCase(); // Get the query parameter
  const limit = parseInt(req.query.limit) || 5; // Get the limit parameter, default to 1 if not provided

  if (!query) {
    return res.status(400).json({ error: "Query parameter is required" });
  }

  // Filter medicines based on query
  const suggestions = Object.values(medicines).filter((medicine) =>
    medicine.toLowerCase().includes(query)
  );

  // Apply the limit to the number of suggestions
  const limitedSuggestions = suggestions.slice(0, limit);

  res.json({ suggestions: limitedSuggestions });
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Server is running on port http://localhost:${port}`);
});
