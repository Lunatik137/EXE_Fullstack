import express from "express";
import { bookConsultation, getMyBookingForDoctor } from "../controllers/consultationController.js";
import optionalAuth from "../middleware/optionalAuth.js";
import authMiddleware from "../middleware/auth.js";

const consultationRouter = express.Router();

consultationRouter.post("/book", optionalAuth, bookConsultation);
consultationRouter.get("/my/:doctorId", authMiddleware, getMyBookingForDoctor);

export default consultationRouter;
