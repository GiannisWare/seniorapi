import express from 'express';
import { signIn, signOut, signup } from '../controllers/auth.controller.js';

const router = express.Router();

router.post('/sign-up', signup);

router.post('/sign-in', signIn);

router.post('/sign-out', signOut);

export default router;
