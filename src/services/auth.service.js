import logger from "#utils/logger.js";
import bcrypt from "bcrypt";
import {db} from "#utils/database.js";
import {eq} from "drizzle-orm";
import {users} from "../models/user.model.js";

export const hashPassword = async (password) => {
    try {
        return await bcrypt.hash(password, 12);
    } catch (e) {
        logger.error(`Error hashing password: ${e}`);
        throw new Error(`${e}`);
    }
}

export const comparePassword = async (password, hashedPassword) => {
    try {
        return await bcrypt.compare(password, hashedPassword);
    } catch (e) {
        logger.error(`Error comparing password: ${e}`);
        throw new Error(`${e}`);
    }
}

export const createUser = async ({name, email, password, role = 'user'}) => {
    try {

        const existingUser = await db.select().from(users).where(eq(users.email, email)).limit(1);

        if (existingUser.length > 0) throw new Error('User with this email already exists');

        const password_hash = await hashPassword(password);

        const [newUser] = await db.insert(users)
            .values({name, email, password: password_hash, role})
            .returning({
                id: users.id,
                name: users.name,
                email: users.email,
                role: users.role,
                created_at: users.created_at
            })

        logger.info(`User ${newUser.email} created nicely bro m`);
        return newUser;

    } catch (e) {
        logger.error(`Error creating user mf: ${e}`);
        throw new Error(`${e}`);
    }
}

export const authenticateUser = async ({email, password}) => {
    try {
        const [existingUser] = await db.select().from(users).where(eq(users.email, email)).limit(1);

        if (!existingUser) throw new Error('User not found');

        const isPasswordValid = await comparePassword(password, existingUser.password);

        if (!isPasswordValid) throw new Error('Invalid password');

        const {password: _, ...user} = existingUser;

        return user;
    } catch (e) {
        logger.error(`Error authenticating user: ${e}`);
        throw new Error(`${e}`);
    }
}
