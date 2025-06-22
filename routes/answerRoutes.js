import express from 'express';
import { uploadAnswers } from '../controllers/AnswerController.js';

const router = express.Router();

router.post('/uploadAnswers', uploadAnswers)

export default router;