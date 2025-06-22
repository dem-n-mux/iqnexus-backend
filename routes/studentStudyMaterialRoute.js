import { Router } from "express";
import { addStudentStudyMaterial } from "../controllers/studentStudyMaterialController.js";
import express from "express";

const router = Router();

router.post(
  "/addStudentStudyMaterial", addStudentStudyMaterial);

export default router;