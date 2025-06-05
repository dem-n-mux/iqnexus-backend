import express from "express";
import {
  getAttendanceStudents,
  getStudentByMobile,
  getAllStudents,
  getStudents,
  getStudentsWithoutPagination,
  getDashboardAnalytics,
  updateStudent,
  addStudent
} from "../controllers/studentController.js";

const router = express.Router();

router.get("/get-student", getStudentByMobile);
router.get("/all-students", getAllStudents);
router.post("/allStudents", getAttendanceStudents)
router.post("/students", getStudents);
router.post("/all-students-no-pagination", getStudentsWithoutPagination);
router.put("/student", updateStudent);
router.post("/add-student", addStudent);
router.get("/dashboard-analytics", getDashboardAnalytics);

export default router;
