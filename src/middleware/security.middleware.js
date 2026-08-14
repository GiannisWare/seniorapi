import aj from '#config/arcjet.js';
import logger from "#utils/logger.js";

export const securityMiddleware = async (req, res, next) => {

    try {
        const decision = await aj.protect(req);
        if (decision.isDenied() && decision.reason.isBot()) {
            logger.warn('Bot request blocked', {
                ip: req.ip, userAgent: req.get('User-Agent'), path: req.path
            })

            return res.status(403).json({error: 'Forbidden', message: "Automated req are not allowed"});
        }

        if (decision.isDenied() && decision.reason.isShield()) {
            logger.warn('Shield blocked request', {
                ip: req.ip, userAgent: req.get('User-Agent'), path: req.path, method: req.method
            })

            return res.status(403).json({error: 'Forbidden', message: "Shield blocked by security policy"});
        }

        if (decision.isDenied() && decision.reason.isRateLimit()) {
            logger.warn('Rate limit exceeded', {
                ip: req.ip, userAgent: req.get('User-Agent'), path: req.path
            })

            return res.status(429).json({error: 'Too many requests', message: "Rate limit exceeded"});
        }

        return next();

    } catch
        (error) {
        console.log('Arcjet middleware error:', error);
        res.status(500).json({
            error: 'Arcjet middleware error',
            message: 'Something went wrong with security middleware'
        });


    }
}
