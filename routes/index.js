import express from "express";

import studentRoutes from "./studentRoutes.js";
import kindergartenRoutes from "./kindergartenRoutes.js";
import admitCardRoutes from "./admitCardRoutes.js";
import certificateRoutes from "./certificateRoutes.js";
import schoolRoutes from "./schoolRoutes.js";
import adminRoutes from "./adminRoutes.js";

const router = express.Router();

router.use("/", studentRoutes);
router.use("/", kindergartenRoutes);
router.use("/", admitCardRoutes);
router.use("/", certificateRoutes);
router.use("/", schoolRoutes);
router.use("/", adminRoutes);

export default router;
