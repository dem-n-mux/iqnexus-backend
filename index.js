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
import { MongoClient, GridFSBucket, ObjectId } from "mongodb";

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

// Simulated database query function (replace with actual MongoDB query)
async function getAdmitCardStudentsByFilters(schoolCode, examLevel, page, limit) {
  const skip = (page - 1) * limit;

  // Build MongoDB query
  const query = {};
  if (schoolCode) query.schoolCode = schoolCode;

  // Filter based on examLevel (L1 or L2 participation)
  if (examLevel === "L1") {
    query.$or = [
      { IAOL1: "1" },
      { ITSTL1: "1" },
      { IMOL1: "1" },
      { IGKOL1: "1" },
      { IENGOL1: "1" },
    ];
  } else if (examLevel === "L2") {
    query.$or = [
      { IAOL2: "1" },
      { ITSTL2: "1" },
      { IMOL2: "1" },
      { IENGOL2: "1" },
    ];
  }

  // Simulated MongoDB query (replace with actual database call)
  const totalStudents = await STUDENT_LATEST.countDocuments(query);
  const students = await STUDENT_LATEST.find(query)
    .skip(skip)
    .limit(limit)
    .select("rollNo schoolCode class  section dob mobNo studentName IAOL1 ITSTL1 IMOL1 IGKOL1 IENGOL1 IAOL2 ITSTL2 IMOL2 IENGOL2");

  const totalPages = Math.ceil(totalStudents / limit);

  return {
    data: students,
    totalPages,
    totalStudents,
  };
}

app.post("/admit-card-students", async (req, res) => {
  try {
    const { schoolCode, examLevel /*, session */ } = req.body;
    const { page = 1, limit = 10 } = req.query;

    const schoolCodeNumber = schoolCode ? parseInt(schoolCode) : undefined;
    if (schoolCode && isNaN(schoolCodeNumber)) {
      return res
        .status(400)
        .json({ error: "Invalid school code: must be a number" });
    }

    if (examLevel && !["L1", "L2"].includes(examLevel)) {
      return res
        .status(400)
        .json({ error: "Invalid exam level: must be L1 or L2" });
    }

    const students = await getAdmitCardStudentsByFilters(
      schoolCodeNumber,
      examLevel,
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
    console.error("❌ Error in admit-card-students route:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Tushar
const examNameMapping = {
  IQMO: 'IMO',
  IQSO: 'ITST',
  IQEO: 'IENGO',
  IQRO: 'IAO',
  IQGKO: 'IGKO'
};

app.post("/allStudents", async (req, res) => {
  const { schoolCode, classes, sections, exam } = req.body;

  // Validate required fields
  if (!schoolCode || !exam) {
    return res.status(400).json({ message: 'School code and exam are required' });
  }

  // Parse exam name and level
  const levelMatch = exam.match(/(L1|L2)$/);
  const examName = exam.replace(/(L1|L2)$/, '');

  if (!levelMatch || !examNameMapping[examName]) {
    return res.status(400).json({ message: 'Invalid exam format or exam name. Expected format: IQEOL1, IQMOL2, etc.' });
  }

  const examLevel = levelMatch[0]; // L1 or L2

  try {
    // Find school
    const school = await School.findOne({ schoolCode }) || {};

    // Build query
    const query = { schoolCode };

    // Add class filter if provided
    if (classes && classes.length > 0) {
      query.class = { $in: classes };
    }

    // Add section filter if provided
    if (sections && sections.length > 0) {
      query.section = { $in: sections };
    }

    // Map new exam name to old exam name and append level
    const oldExamName = examNameMapping[examName];
    const examField = `${oldExamName}${examLevel}`;

    // Add exam filter (value must be "1")
    query[examField] = "1";

    // Fetch students
    const students = await STUDENT_LATEST.find(query);
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
app.post('/fetch-admit-card', async (req, res) => {
  try {
    const { mobNo, level } = req.body;

    const Level = level === 'basic' ? "L1" : "L2"

    // Validate inputs
    if (!mobNo || !level || !['L1', 'L2'].includes(Level)) {
      return res
        .status(400)
        .json({ error: 'Mobile number and valid level (basic/L1 or L2) are required' });
    }

    let studentData = await STUDENT_LATEST.findOne({ mobNo }).lean();

    // Convert studentId to ObjectId
    let objectId;
    try {
      objectId = new ObjectId(studentData._id);
    } catch (error) {
      return res.status(400).json({ error: 'Invalid student ID format' });
    }

    await fetchAdmitCardFromDB(objectId, studentData.studentName, Level, res);
  } catch (error) {
    console.error('Error processing request:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to process request' });
    }
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
// app.post("/admit-card", async (req, res) => {
//   const { mobNo, level, session } = req.body;

//   if (!mobNo) {
//     return res.status(400).json({ error: "Mobile number is required" });
//   }

//   let studentData = studentCache[mobNo] || (await fetchDataByMobile(mobNo));
//   if (!studentData || !studentData["Mob No"]) {
//     return res
//       .status(404)
//       .json({ error: "No student found with this mobile number" });
//   }
//   studentCache[mobNo] = studentData;

//   try {
//     const result = await generateAdmitCard(studentData, level, session);
//     if (!result.success) {
//       return res.status(500).json({ error: result.error });
//     }

//     await dbConnection();
//     await uploadAdmitCard(studentData, res, level, session);

//     if (!res.headersSent) {
//       return res.status(200).json({
//         message: "Admit card generated and stored successfully",
//         path: result.path,
//       });
//     }
//   } catch (error) {
//     if (!res.headersSent) {
//       return res.status(500).json({ error: "Internal server error" });
//     }
//   }
// });

async function fetchStudentsByFilters({ schoolCode, level }) {
  try {
    // Validate inputs
    if (!schoolCode || !level) {
      throw new Error("schoolCode and level are required");
    }

    // Build the query
    const query = {
      schoolCode: Number(schoolCode),
    };

    // Filter by level (L1 or L2 exams)
    if (level === "L1") {
      query.$or = [
        { IAOL1: "1" },
        { ITSTL1: "1" },
        { IMOL1: "1" },
        { IGKOL1: "1" },
        { IENGOL1: "1" },
      ];
    } else if (level === "L2") {
      query.$or = [
        { IAOL2: "1" },
        { ITSTL2: "1" },
        { IMOL2: "1" },
        { IGKOL2: "1" },
        { IENGOL2: "1" },
      ];
    } else {
      throw new Error("Invalid level: must be L1 or L2");
    }

    // Execute the query 
    const students = await STUDENT_LATEST.find(query)
      .select("rollNo studentName schoolCode class section fatherName motherName dob mobNo IAOL1 ITSTL1 IMOL1 IGKOL1 IENGOL1 IAOL2 ITSTL2 IMOL2 IGKOL2 IENGOL2")
      .lean();

    if (!students || students.length === 0) {
      return [];
    }
    return students;
  } catch (error) {
    console.error("Error fetching students by filters:", error);
    throw error; // Let the caller handle the error
  }
}

app.post("/admit-card", async (req, res) => {
  const { schoolCode, level, /* session, */ examDate } = req.body;

  // Validate required fields
  if (!schoolCode || !level || !examDate) {
    return res.status(400).json({ error: "School code, level, and exam date are required" });
  }

  const school = await School.findOne({ schoolCode });

  try {
    const dbResponse = await dbConnection();
    if (dbResponse.status !== "success") {
      return res.status(500).json({ error: "Database connection failed" });
    }
    const db = dbResponse.conn.db;

    // Fetch students
    const students = await fetchStudentsByFilters({ schoolCode, level });

    if (!students || students.length === 0) {
      return res.status(404).json({ error: "No students found for the provided filters" });
    }

    // Deduplicate students by mobNo
    const uniqueStudents = [];
    const seenMobNos = new Set();
    for (const student of students) {
      if (!seenMobNos.has(student.mobNo)) {
        uniqueStudents.push(student);
        seenMobNos.add(student.mobNo);
      } else {
        console.warn(`Duplicate student found: mobNo ${student.mobNo}`);
      }
    }

    // Use student cache
    const cachedStudents = uniqueStudents.map((student) => {
      if (studentCache[student.mobNo]) {
        console.log(`Cache hit for mobNo: ${student.mobNo}`);
      }
      const studentData = studentCache[student.mobNo] || student;
      studentCache[student.mobNo] = studentData;
      return studentData;
    });

    // Generate admit cards with examDate
    const generateResults = await generateAdmitCard(cachedStudents, level, /* session, */ examDate, school);

    // Upload admit cards
    const uploadResults = await uploadAdmitCard(cachedStudents, level, db, examDate);

    // Combine results
    const results = generateResults.map((gen, index) => ({
      mobNo: gen.mobNo,
      success: gen.success && uploadResults[index].success,
      path: gen.path,
      fileId: uploadResults[index].fileId,
      error: gen.error || uploadResults[index].error,
      message: uploadResults[index].message,
    }));

    const failed = results.filter((r) => r.error);
    if (failed.length > 0) {
      return res.status(207).json({
        message: "Some admit cards failed to generate or upload",
        results,
      });
    }

    return res.status(200).json({
      message: "All admit cards generated and stored successfully",
      results,
    });
  } catch (error) {
    console.error("Error generating admit cards:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/student-admit-card/:phone", async (req, res) => {
  const { phone } = req.params;
  const dbResponse = await dbConnection();

  if (dbResponse.status !== "success") {
    return res.status(500).json({ error: "Database connection failed" });
  }

  const db = dbResponse.conn.db;

  try {
    const admitcard = await db
      .collection("admitCards.files")
      .findOne({ "metadata.mobNo": phone });

    if (!admitcard) {
      return res.status(404).json({ error: "Admit card not found" });
    }

    return res.status(200).json({ result: admitcard });
  } catch (error) {
    console.error("Error fetching admit card:", error);
    res.status(500).json({ error: "Internal server error" });
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

app.get("/all-school-admit-card", async (req, res) => {
  try {
    const schools = await School.find({})
    return res.status(200).json({ schools, success: true });
  } catch (error) {
    console.error("❌ Error fetching schools:", error);
    res.status(500).json({ message: "Error fetching schools", error });
  }
})


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

app.post("/all-students-no-pagination", async (req, res) => {
  try {
    const { schoolCode, className, rollNo, section, studentName, subject } = req.body;
    let query = {};

    if (schoolCode) query.schoolCode = Number(schoolCode);
    if (className && className.length > 0) query.class = { $in: className };
    if (rollNo) query.rollNo = rollNo;
    if (section && section.length > 0) query.section = { $in: section };
    if (studentName) query.studentName = { $regex: studentName, $options: "i" };
    if (subject) query[subject] = "1";

    const data = await STUDENT_LATEST.find(query);
    const totalStudents = data.length;

    return res.status(200).json({
      success: true,
      data,
      totalStudents,
    });
  } catch (error) {
    console.error("❌ Error fetching all students without pagination:", error);
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
