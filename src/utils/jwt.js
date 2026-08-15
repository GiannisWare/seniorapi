import jwt from 'jsonwebtoken';
import logger from '#utils/logger.js';

const JWT_SECRET =
  process.env.JWT_SECRET || 'your-secret-key-please-change-inprod';
const JWT_EXPIRES_IN = '1d';

export const jwttoken = {
  sign: payload => {
    try {
      return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    } catch (e) {
      logger.error('Failed to authenticate the token', e);
      throw new Error('Unable to authenticate the token', { cause: e });
    }
  },
  verify: token => {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (e) {
      logger.error('Failed to authenticate the token', e);
      throw new Error('Unable to authenticate the token', { cause: e });
    }
  },
};
