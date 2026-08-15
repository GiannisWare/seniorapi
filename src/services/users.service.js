import logger from '#utils/logger.js';
import { db } from '#utils/database.js';
import { and, eq, ne } from 'drizzle-orm';
import { users } from '../models/user.model.js';

const userSelection = {
  id: users.id,
  name: users.name,
  email: users.email,
  role: users.role,
  createdAt: users.created_at,
  updatedAt: users.updated_at,
};

export const getAllUsers = async () => {
  try {
    return await db.select(userSelection).from(users);
  } catch (e) {
    logger.error('Error getting users', e);
    throw e;
  }
};

export const getUserById = async id => {
  try {
    const [user] = await db
      .select(userSelection)
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return user || null;
  } catch (e) {
    logger.error(`Error getting user by id ${id}`, e);
    throw e;
  }
};

export const updateUser = async (id, updates) => {
  try {
    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!existingUser) {
      throw new Error('User not found');
    }

    const sanitizedUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, value]) => value !== undefined)
    );

    if (sanitizedUpdates.email) {
      const [duplicateUser] = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.email, sanitizedUpdates.email), ne(users.id, id)))
        .limit(1);

      if (duplicateUser) {
        throw new Error('User with this email already exists');
      }
    }

    const [updatedUser] = await db
      .update(users)
      .set({
        ...sanitizedUpdates,
        updated_at: new Date(),
      })
      .where(eq(users.id, id))
      .returning(userSelection);

    return updatedUser;
  } catch (e) {
    logger.error(`Error updating user ${id}`, e);
    throw e;
  }
};

export const deleteUser = async id => {
  try {
    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!existingUser) {
      throw new Error('User not found');
    }

    const [deletedUser] = await db
      .delete(users)
      .where(eq(users.id, id))
      .returning(userSelection);

    return deletedUser;
  } catch (e) {
    logger.error(`Error deleting user ${id}`, e);
    throw e;
  }
};
