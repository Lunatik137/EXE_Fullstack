import express from "express";
import { getAllDoctors, getDoctorById } from "../controllers/doctorController.js";
import optionalAuth from "../middleware/optionalAuth.js";

const doctorRouter = express.Router();

doctorRouter.get("/", optionalAuth, getAllDoctors);
doctorRouter.get("/:id", optionalAuth, getDoctorById);

export default doctorRouter;
