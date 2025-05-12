import express from "express";
import multer from "multer";
import cors from "cors";
import fs from "fs/promises";
import dotenv from "dotenv";
import { fetchDataByMobile } from "./service.js";
import {
  generateAdmitCard,
  dbConnection,
  uploadAdmitCard,
  fetchAdmitCardFromDB,
} from "./admitCardService.js";
import { generateAndUploadDocument, fetchImage } from "./certificateService.js";
import { fetchStudyMaterial, StudyMaterial } from "./studyMaterialService.js";
import { excelToMongoDbForStudent } from "./excelToMongoForStudent.js";
import {
  STUDENT_LATEST,
  getStudentsByFilters,
} from "./newStudentModel.model.js";
import mongoose from "mongoose";
import { School } from "./school.js";
import { convertXlsxToMongoDbForSchool } from "./excelToMongoForSchool.js";
import { Admin } from "./admin.js";
import { Int32 } from "mongodb";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const studentCache = {};

const uploadDir = "uploads";
if (!fs.stat(uploadDir).catch(() => fs.mkdir(uploadDir))) {
  console.log("Uploads directory created");
}

const upload = multer({ dest: "uploads/" });

app.use(cors({ origin: "*" }));
app.use(express.json());

// MongoDB Connection
if (!process.env.MONGO_URI) {
  console.error("Error: MONGO_URI is not defined in .env file");
  process.exit(1); // Exit the process if MONGO_URI is missing
}

mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// API to fetch student details
app.get("/get-student", async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(400).json({ error: "Mobile number is required" });
  }

  const mobNo = authHeader.split("Bearer ")[1];

  if (studentCache[mobNo]) {
    return res
      .status(200)
      .json({ studentData: studentCache[mobNo], mobile: mobNo });
  }

  try {
    const studentData = await fetchDataByMobile(mobNo);

    if (studentData["Mob No"]) {
      studentCache[mobNo] = studentData;
      return res
        .status(200)
        .json({ studentData, mobile: studentData["Mob No"] });
    }

    return res
      .status(404)
      .json({ error: "No student found with this mobile number" });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch student data", error });
  }
});

// API to fetch students by school and class (used by frontend)
app.post("/students", async (req, res) => {
  try {
    const {
      schoolCode,
      className,
      rollNo,
      section,
      studentName,
      subject,
    } = req.body;
    const { page = 1, limit = 10 } = req.query;

    const schoolCodeNumber = schoolCode ? parseInt(schoolCode) : undefined;
    if (schoolCode && isNaN(schoolCodeNumber)) {
      return res
        .status(400)
        .json({ error: "Invalid school code: must be a number" });
    }

    const students = await getStudentsByFilters(
      schoolCodeNumber,
      className,
      rollNo,
      section,
      studentName,
      subject,
      Number(page),
      Number(limit)
    );

    if (students.data.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No students found matching the criteria",
        data: [],
        totalPages: 0,
        currentPage: Number(page),
        totalStudents: 0,
      });
    }

    return res.status(200).json({
      success: true,
      data: students.data,
      totalPages: students.totalPages,
      currentPage: Number(page),
      totalStudents: students.totalStudents,
    });
  } catch (error) {
    console.error("❌ Error in route:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Tushar
app.post("/allStudents", async (req, res) => {
  const { schoolCode, class: cls, section, exam, examLevel } = req.body;

  if (!schoolCode || !cls || !section || !exam || !examLevel) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  const school = await School.findOne({ schoolCode: schoolCode });

  try {
    const students = await STUDENT_LATEST.find({
      schoolCode,
      class: cls,
      section,
    });

    // Filter students who participated in the selected exam (value === "1")
    // const filtered = students.filter(student => student[exam] === "1");
    return res.status(200).json({ student: students, school });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }

});
// Tushar

// API to update single student
app.put("/student", async (req, res) => {
  try {
    const { rollNo, _id, ...updateFields } = req.body;

    // Validate required fields
    if (!_id && !rollNo) {
      return res
        .status(400)
        .json({ message: "Either _id or rollNo is required" });
    }

    // Validate required fields
    if (updateFields.rollNo && updateFields.rollNo.trim() === "") {
      return res.status(400).json({ message: "rollNo cannot be empty" });
    }
    if (updateFields.schoolCode && isNaN(updateFields.schoolCode)) {
      return res.status(400).json({ message: "schoolCode must be a number" });
    }
    if (updateFields.class && updateFields.class.trim() === "") {
      return res.status(400).json({ message: "class cannot be empty" });
    }
    if (updateFields.section && updateFields.section.trim() === "") {
      return res.status(400).json({ message: "section cannot be empty" });
    }
    if (updateFields.studentName && updateFields.studentName.trim() === "") {
      return res.status(400).json({ message: "studentName cannot be empty" });
    }

    // Validate Duplicates field
    if (updateFields.Duplicates !== undefined) {
      if (
        updateFields.Duplicates !== true &&
        updateFields.Duplicates !== false &&
        updateFields.Duplicates !== "true" &&
        updateFields.Duplicates !== "false" &&
        updateFields.Duplicates !== "1" &&
        updateFields.Duplicates !== "0"
      ) {
        return res
          .status(400)
          .json({ message: "Duplicates must be a boolean value" });
      }
      // Convert to boolean
      updateFields.Duplicates =
        updateFields.Duplicates === "1" ||
        updateFields.Duplicates === "true" ||
        updateFields.Duplicates === true;
    }

    let updatedStudent;
    if (_id) {
      // Update by _id
      updatedStudent = await STUDENT_LATEST.findByIdAndUpdate(
        _id,
        { $set: updateFields },
        { new: true, runValidators: true }
      );
    } else {
      // Update by rollNo
      updatedStudent = await STUDENT_LATEST.findOneAndUpdate(
        { rollNo },
        { $set: updateFields },
        { new: true, runValidators: true }
      );
    }

    if (!updatedStudent) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Check for rollNo uniqueness if rollNo is being updated
    if (updateFields.rollNo && updateFields.rollNo !== rollNo) {
      const existingStudent = await STUDENT_LATEST.findOne({
        rollNo: updateFields.rollNo,
        _id: { $ne: updatedStudent._id },
      });
      if (existingStudent) {
        return res.status(400).json({ message: "rollNo must be unique" });
      }
    }

    res.json({ message: "Student updated successfully", updatedStudent });
  } catch (error) {
    console.error("Error updating student:", error);
    if (error.name === "CastError") {
      res.status(400).json({
        message: `Invalid value for ${error.path}: ${error.value}`,
      });
    } else if (error.code === 11000) {
      res.status(400).json({ message: "rollNo must be unique" });
    } else {
      res.status(500).json({
        message: "Error updating student",
        error: error.message || error,
      });
    }
  }
});

// API to fetch admit-card
app.post("/fetch-admit-card", async (req, res) => {
  try {
    const { mobNo, level, session } = req.body;

    let studentData = studentCache[mobNo] || (await fetchDataByMobile(mobNo));
    if (!studentData || !studentData["Mob No"]) {
      return res
        .status(404)
        .json({ error: "No student found with this mobile number" });
    }
    studentCache[mobNo] = studentData;

    const studentName = studentData["Student's Name"];
    if (!studentName) {
      return res
        .status(400)
        .json({ error: "Invalid student details in cache" });
    }
    await fetchAdmitCardFromDB(studentName, res, level, session);
  } catch (error) {
    console.error("Error processing request:", error);
    res.status(500).json({ error: "Failed to process request" });
  }
});

// API to fetch certificate
app.get("/fetch-ceritficate/:mobNo", async (req, res) => {
  const { mobNo } = req.params;

  let studentData = studentCache[mobNo] || (await fetchDataByMobile(mobNo));
  if (!studentData || !studentData["Mob No"]) {
    return res
      .status(404)
      .json({ error: "No student found with this mobile number" });
  }
  studentCache[mobNo] = studentData;

  const studentName = studentData["Student's Name"];
  if (!studentName) {
    return res.status(400).json({ error: "Invalid student details in cache" });
  }
  fetchImage("certificate", studentName, res);
});

// API to generate & upload admit card
app.post("/admit-card", async (req, res) => {
  const { mobNo, level, session } = req.body;

  if (!mobNo) {
    return res.status(400).json({ error: "Mobile number is required" });
  }

  let studentData = studentCache[mobNo] || (await fetchDataByMobile(mobNo));
  if (!studentData || !studentData["Mob No"]) {
    return res
      .status(404)
      .json({ error: "No student found with this mobile number" });
  }
  studentCache[mobNo] = studentData;

  try {
    const result = await generateAdmitCard(studentData, level, session);
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    await dbConnection();
    await uploadAdmitCard(studentData, res, level, session);

    if (!res.headersSent) {
      return res.status(200).json({
        message: "Admit card generated and stored successfully",
        path: result.path,
      });
    }
  } catch (error) {
    if (!res.headersSent) {
      return res.status(500).json({ error: "Internal server error" });
    }
  }
});

// API to generate & upload certificate or admit card
app.post("/generate/:type", async (req, res) => {
  const { type } = req.params;
  const { mobNo } = req.body;

  let studentData = studentCache[mobNo] || (await fetchDataByMobile(mobNo));
  if (!studentData || !studentData["Mob No"]) {
    return res
      .status(404)
      .json({ error: "No student found with this mobile number" });
  }
  studentCache[mobNo] = studentData;

  const studentName = studentData["Student's Name"];
  if (!studentName) {
    return res.status(400).json({ error: "Invalid student details in cache" });
  }
  if (!["certificate", "admitCard"].includes(type)) {
    return res
      .status(400)
      .json({ error: "Invalid type. Use 'certificate' or 'admitCard'" });
  }

  try {
    const fileName = await generateAndUploadDocument(studentData, type);
    res.json({
      message: `${type} generated and uploaded successfully!`,
      fileName,
    });
  } catch (error) {
    res.status(500).json({
      error: `Error generating/uploading ${type}`,
      details: error.message,
    });
  }
});

// API to fetch study material
app.post("/fetch-study-material", async (req, res) => {
  const { mobNo } = req.body;

  try {
    let studentData = studentCache[mobNo] || (await fetchDataByMobile(mobNo));
    if (!studentData || !studentData["Mob No"]) {
      return res
        .status(404)
        .json({ error: "No student found with this mobile number" });
    }
    studentCache[mobNo] = studentData;

    const studentClass = studentData["Class"];
    if (!studentClass) {
      return res
        .status(400)
        .json({ error: "Invalid student details in cache" });
    }
    const materials = await fetchStudyMaterial(studentClass);
    res.status(200).json({ success: true, data: materials });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// API to upload school data in bulk
app.post("/upload-schooldata", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "Please upload an XLSX file" });
  }

  try {
    const response = await convertXlsxToMongoDbForSchool(req.file.path);
    res.status(200).json(response);
  } catch (error) {
    console.error("Error uploading school data:", error);
    res.status(500).json({ error: error.message });
  } finally {
    // Clean up the uploaded file
    await fs
      .unlink(req.file.path)
      .catch((err) => console.error("Error deleting file:", err));
  }
});

// API to upload student data in bulk
app.post("/upload-studentData", upload.single("file"), async (req, res) => {

  if (!req.file) {
    return res.status(400).json({ message: "Please upload a CSV file" });
  }

  try {
    const response = await excelToMongoDbForStudent(req.file.path);
    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API to add single student
app.post("/add-student", async (req, res) => {
  try {
    const newStudent = new STUDENT_LATEST(req.body);
    const savedStudent = await newStudent.save();

    res.status(201).json({
      message: "Student added successfully",
      collection: savedStudent.constructor.collection.name,
      documentId: savedStudent._id,
    });
  } catch (error) {
    console.error("❌ Error adding student:", error);
    res.status(500).json({ message: "Error adding student", error });
  }
});

app.get("/all-schools", async (req, res) => {
  try {
    const { page, limit } = req.query;
    const schools = await School.find()
      .skip((page - 1) * limit)
      .limit(limit);
    const totalPages = Math.ceil((await School.countDocuments()) / limit);

    return res.status(200).json({ schools, totalPages, success: true });
  } catch (error) {
    console.error("❌ Error fetching schools:", error);
    res.status(500).json({ message: "Error fetching schools", error });
  }
});

// get-school

app.get("/get-school/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const school = await School.findOne({ schoolCode: id })
    return res.status(200).json({ school, success: true });
  } catch (error) {
    console.error("❌ Error fetching schools:", error);
    res.status(500).json({ message: "Error fetching schools", error });
  }
});


app.put("/school", async (req, res) => {
  try {
    const { schoolCode, ...updateFields } = req.body;

    if (!schoolCode) {
      return res.status(400).json({ message: "School Code is required" });
    }

    const updatedSchool = await School.findOneAndUpdate(
      { schoolCode },
      { $set: updateFields },
      { new: true, runValidators: true }
    );

    if (!updatedSchool) {
      return res.status(404).json({ message: "School not found" });
    }

    return res.status(200).json({
      message: "School updated successfully",
      updatedSchool,
      success: true,
    });
  } catch (error) {
    console.error("❌ Error updating school:", error);
    res.status(500).json({ message: "Error updating school", error });
  }
});

app.delete("/school/:schoolCode", async (req, res) => {
  const { schoolCode } = req.params;

  if (!schoolCode) {
    return res.status(400).json({ message: "School Code is required" });
  }

  let parsedCode = parseInt(schoolCode, 10);
  if (isNaN(parsedCode)) {
    return res.status(400).json({ message: "Invalid School Code format" });
  }

  const queryCode = new Int32(parsedCode);

  try {
    const deletedSchool = await School.findOneAndDelete({
      schoolCode: queryCode,
    });

    if (!deletedSchool) {
      return res.status(404).json({ message: "School not found" });
    }

    return res.status(200).json({
      message: "School deleted successfully",
      success: true,
    });
  } catch (error) {
    console.error("Error deleting school:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

app.post("/add-school", async (req, res) => {

  try {
    const newSchool = new School(req.body);
    const savedSchool = await newSchool.save();
    return res.status(201).json({
      message: "School added successfully",
      collection: savedSchool.constructor.collection.name,
      documentId: savedSchool._id,
      success: true,
    });
  } catch (error) {
    console.error("❌ Error adding school:", error);
    res.status(500).json({ message: "Error adding school", error });
  }
});

app.get("/all-students", async (req, res) => {
  try {
    const { page, limit } = req.query;
    const allStudents = await STUDENT_LATEST.find()
      .skip((page - 1) * limit)
      .limit(limit);
    const totalPages = Math.ceil(
      (await STUDENT_LATEST.countDocuments()) / limit
    );
    const totalStudents = await STUDENT_LATEST.countDocuments();
    return res
      .status(200)
      .json({ allStudents, totalPages, totalStudents, success: true });
  } catch (error) {
    console.error("❌ Error fetching all students:", error);
    res.status(500).json({ message: "Error fetching all students", error });
  }
});

app.get("/dashboard-analytics", async (req, res) => {
  try {
    const allStudents = await STUDENT_LATEST.countDocuments();
    const allSchools = await School.countDocuments();
    const allStudyMaterials = await StudyMaterial.countDocuments();
    return res
      .status(200)
      .json({ allStudents, allSchools, allStudyMaterials, success: true });
  } catch (error) {
    console.error("❌ Error fetching all students:", error);
    res.status(500).json({ message: "Error fetching all students", error });
  }
});

app.post("/admin/signup", async (req, res) => {
  try {
    const { email, password } = req.body;

    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return res.status(400).json({ message: "Admin already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newAdmin = new Admin({ email, password: hashedPassword });
    await newAdmin.save();

    return res.status(201).json({ message: "Admin created successfully" });
  } catch (err) {
    return res
      .status(500)
      .json({ error: "Server error", details: err.message });
  }
});

app.post("/admin/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid password" });
    }

    return res.status(200).json({ message: "Login successful" });
  } catch (err) {
    return res
      .status(500)
      .json({ error: "Server error", details: err.message });
  }
});

// Health check
app.get("/health", async (req, res) => {
  res.status(200).json({ message: "Server is Healthy" });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is UP and RUNNING on port ${PORT}`);
});

export default app;
