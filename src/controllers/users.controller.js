import logger from '#config/logger.js';
import { cookies } from '../utils/cookies.js';
import { jwttoken } from '../utils/jwt.js';
import { formatValidation } from '../utils/format.js';
import {
  getAllUsers,
  getUserById as fetchUserById,
  updateUser as updateUserRecord,
  deleteUser as deleteUserRecord,
} from '../services/users.service.js';
import {
  updateUserSchema,
  userIdSchema,
} from '../validations/users.validation.js';

const getAuthenticatedUser = req => {
  const token = cookies.get(req, 'token');

  if (!token) {
    throw new Error('Unauthorized');
  }

  const payload = jwttoken.verify(token);

  return {
    id: Number(payload.id),
    email: payload.email,
    role: payload.role,
  };
};

export const fetchAllUsers = async (req, res, next) => {
  try {
    logger.info('Getting all users...');

    const allUsers = await getAllUsers();

    res.json({
      message: 'Successfully retrieved all users.',
      users: allUsers,
      count: allUsers.length,
    });
  } catch (e) {
    logger.error(e);
    next(e);
  }
};

export const getUserById = async (req, res, next) => {
  try {
    logger.info(`Getting user ${req.params.id}...`);

    const validationResult = userIdSchema.safeParse(req.params);

    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: formatValidation(validationResult.error),
      });
    }

    getAuthenticatedUser(req);

    const user = await fetchUserById(validationResult.data.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json({
      message: 'Successfully retrieved user.',
      user,
    });
  } catch (e) {
    logger.error(`Error getting user ${req.params.id}`, e);

    if (e.message === 'Unauthorized') {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    next(e);
  }
};

export const updateUser = async (req, res, next) => {
  try {
    logger.info(`Updating user ${req.params.id}...`);

    const idResult = userIdSchema.safeParse(req.params);
    if (!idResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: formatValidation(idResult.error),
      });
    }

    const bodyResult = updateUserSchema.safeParse(req.body);
    if (!bodyResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: formatValidation(bodyResult.error),
      });
    }

    const currentUser = getAuthenticatedUser(req);
    const targetUserId = idResult.data.id;

    if (currentUser.role !== 'admin' && currentUser.id !== targetUserId) {
      return res
        .status(403)
        .json({
          error: 'Forbidden',
          message: 'You can only update your own account',
        });
    }

    if (currentUser.role !== 'admin' && bodyResult.data.role !== undefined) {
      return res
        .status(403)
        .json({ error: 'Forbidden', message: 'Only admins can change roles' });
    }

    const updatedUser = await updateUserRecord(targetUserId, bodyResult.data);

    if (currentUser.id === targetUserId) {
      const refreshedToken = jwttoken.sign({
        id: updatedUser.id,
        email: updatedUser.email,
        role: updatedUser.role,
      });

      cookies.set(res, 'token', refreshedToken);
    }

    return res.status(200).json({
      message: 'User updated successfully',
      user: updatedUser,
    });
  } catch (e) {
    logger.error(`Error updating user ${req.params.id}`, e);

    if (e.message === 'Unauthorized') {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (e.message === 'User not found') {
      return res.status(404).json({ error: 'User not found' });
    }

    if (e.message === 'User with this email already exists') {
      return res
        .status(409)
        .json({ error: 'User with this email already exists' });
    }

    next(e);
  }
};

export const deleteUser = async (req, res, next) => {
  try {
    logger.info(`Deleting user ${req.params.id}...`);

    const validationResult = userIdSchema.safeParse(req.params);

    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: formatValidation(validationResult.error),
      });
    }

    const currentUser = getAuthenticatedUser(req);
    const targetUserId = validationResult.data.id;

    if (currentUser.role !== 'admin' && currentUser.id !== targetUserId) {
      return res
        .status(403)
        .json({
          error: 'Forbidden',
          message: 'You can only delete your own account',
        });
    }

    const deletedUser = await deleteUserRecord(targetUserId);

    if (currentUser.id === targetUserId) {
      cookies.clear(res, 'token');
    }

    return res.status(200).json({
      message: 'User deleted successfully',
      user: deletedUser,
    });
  } catch (e) {
    logger.error(`Error deleting user ${req.params.id}`, e);

    if (e.message === 'Unauthorized') {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (e.message === 'User not found') {
      return res.status(404).json({ error: 'User not found' });
    }

    next(e);
  }
};
