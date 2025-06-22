import { Router } from "express";
import { addStudentStudyMaterial } from "../controllers/studentStudyMaterialController.js";
import express from "express";
import { fetchStudyMaterial } from "../services/studyMaterialService.js";
const router = Router();

router.post("/addStudentStudyMaterial", addStudentStudyMaterial);
router.post("/fetchStudyMaterial", fetchStudyMaterial);

export default router;