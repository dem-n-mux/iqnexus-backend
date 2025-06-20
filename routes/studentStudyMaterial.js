import express from "express";
import { addStudentStudyMaterial } from "../controllers/studentStudyMaterialController.js";
import multer from "multer";
const router = express.Router();

const upload = multer({ dest: "uploads/" });

router.get("/add-studyMaterial", upload.single("pdf"), addStudentStudyMaterial);
export default router;