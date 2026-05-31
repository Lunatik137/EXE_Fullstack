import express from 'express';
import { addWeight, getWeightHistory, getLatestWeight, deleteWeight } from '../controllers/weightController.js';
import authMiddleware from '../middleware/auth.js';

const weightRouter = express.Router();

weightRouter.post('/add', authMiddleware, addWeight);
weightRouter.post('/history', authMiddleware, getWeightHistory);
weightRouter.post('/latest', authMiddleware, getLatestWeight);
weightRouter.post('/delete', authMiddleware, deleteWeight);

export default weightRouter;
