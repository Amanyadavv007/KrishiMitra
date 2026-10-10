import { Request, Response } from "express";
import { getDigitalTwin, updateDigitalTwin, simulateSensorPulse } from "../services/digitalTwin/digitalTwin.service.js";
import { spawn } from "child_process";
import path from "path";

export const getTwin = (req: Request, res: Response): void => {
  try {
    const farmerId = (req.query.farmerId as string) || "farmer-demo-1";
    const data = getDigitalTwin(farmerId);
    res.json({ success: true, ...data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateTwin = (req: Request, res: Response): void => {
  try {
    const farmerId = (req.body.farmerId as string) || "farmer-demo-1";
    const updated = updateDigitalTwin(farmerId, req.body.updates || {});
    res.json({ success: true, state: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const triggerSensorPulse = (req: Request, res: Response): void => {
  try {
    const farmerId = (req.body.farmerId as string) || "farmer-demo-1";
    const pulseResult = simulateSensorPulse(farmerId);
    res.json({ success: true, ...pulseResult });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const predictCrop = (req: Request, res: Response): void => {
  const { ph, moisture, temperature, rainfall } = req.body;
  if (ph == null || moisture == null || temperature == null || rainfall == null) {
    res.status(400).json({ success: false, message: "Missing required soil/weather parameters" });
    return;
  }
  const backendDir = process.cwd().endsWith("backend") ? process.cwd() : path.join(process.cwd(), "backend");
  const rootDir = path.resolve(backendDir, "..");
  
  const pythonExecutable = path.join(rootDir, ".venv", "Scripts", "python.exe");
  const scriptPath = path.join(backendDir, "scripts", "predict.py");
  
  const inputData = JSON.stringify({ ph, moisture, temperature, rainfall });
  
  const pythonProcess = spawn(pythonExecutable, [scriptPath, inputData]);
  
  let outputData = "";
  let errorData = "";
  
  pythonProcess.stdout.on("data", (data: any) => {
    outputData += data.toString();
  });
  
  pythonProcess.stderr.on("data", (data: any) => {
    errorData += data.toString();
  });
  
  pythonProcess.on("close", (code: number | null) => {
    if (code !== 0) {
      console.error("Python Error:", errorData);
      res.status(500).json({ success: false, message: "AI Prediction failed" });
      return;
    }
    try {
      const result = JSON.parse(outputData);
      if (result.success) {
        res.json({ success: true, prediction: result.prediction });
      } else {
        res.status(500).json({ success: false, message: result.error });
      }
    } catch (err) {
      console.error("Parse Error:", err, outputData);
      res.status(500).json({ success: false, message: "Invalid output from AI model" });
    }
  });
};
