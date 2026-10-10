import { Router } from "express";
import { getTwin, updateTwin, triggerSensorPulse, predictCrop } from "../controllers/digitalTwin.controller.js";

const router = Router();
router.get("/", getTwin);
router.put("/", updateTwin);
router.post("/pulse", triggerSensorPulse);
router.post("/predict-crop", predictCrop);

export default router;
