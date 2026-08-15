import logger from "#utils/logger.js";
import {jwttoken} from "../utils/jwt.js";

export const authenticateToken = (req, res, next) => {
    try {
        const token = req.cookies.token;

        if (!token) {
            return res.status(401).json({
                error: 'Authentication required',
                message: 'No access token provided'
            });
        }

        const decoded = jwttoken.verify(token);
        req.user = decoded;

        logger.info(`User authenticated: ${decoded.email} ${decoded.role}`);
        next();
    } catch
        (e) {
        logger.error('Authentication error', e);

        if (e.message === 'Failed to authenticate token') {
            return res.status(401).json({error: 'Authentication failed'});
        }
    }
}

export const requireRole = (allowedRoles) => {
    return (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json({
                    error: 'Authentication required',
                    message: 'No access token provided'
                });
            }

            if (!allowedRoles.includes(req.user.role)) {
                logger.warn(`Access denied for user ${req.user.email} with role ${req.user.role}. Required: ${allowedRoles.join(', ')}`);
                return res.status(403).json({
                    error: 'Access denied',
                    message: 'Insufficient roles for user ' + req.user.role
                })
            }
            next();
        } catch (e) {
            logger.error('Require role', e);
        }
    }
}