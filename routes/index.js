import express from "express";

import studentRoutes from "./studentRoutes.js";
import kindergartenRoutes from "./kindergartenRoutes.js";
import admitCardRoutes from "./admitCardRoutes.js";
import certificateRoutes from "./certificateRoutes.js";
import schoolRoutes from "./schoolRoutes.js";
import adminRoutes from "./adminRoutes.js";
import studyroutes from "./studentStudyMaterialRoute.js"

const router = express.Router();

router.use("/", studentRoutes);
router.use("/", kindergartenRoutes);
router.use("/", admitCardRoutes);
router.use("/", certificateRoutes);
router.use("/", schoolRoutes);
router.use("/", adminRoutes);
router.use("/", studyroutes);

export default router;
