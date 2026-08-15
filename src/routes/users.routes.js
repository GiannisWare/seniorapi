import express from 'express';
import {
  deleteUser,
  fetchAllUsers,
  getUserById,
  updateUser,
} from '../controllers/users.controller.js';
import {
  authenticateToken,
  requireRole,
} from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/', authenticateToken, requireRole(['admin']), fetchAllUsers);

router.get('/:id', authenticateToken, getUserById);

router.put('/:id', authenticateToken, updateUser);

router.delete('/:id', authenticateToken, requireRole(['admin']), deleteUser);

export default router;
