import express from 'express';
import { uploadResult,getResult } from '../controllers/resultController.js';


const router = express.Router();

router.post('/uploadResult', uploadResult )
router.post('/getResult', getResult) 
export default router;