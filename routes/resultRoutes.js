import express from 'express';
import { uploadResult,getResult } from '../controllers/resultController.js';
import { fetchBLQList } from '../controllers/BLQListController.js';

const router = express.Router();

router.post('/uploadResult', uploadResult )
router.post('/getResult', getResult) 
router.get('/fetchBLQList', fetchBLQList);
export default router;