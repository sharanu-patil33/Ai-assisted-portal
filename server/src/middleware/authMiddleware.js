// server/src/middleware/authMiddleware.js
// Layer 2: Centralized Authentication & Role-Based Access Control (ADR-003)

const { verifyToken } = require("../modules/auth/authService");
const { AuthenticationError, AuthorizationError } = require("../models/domainErrors");

function createAuthMiddleware(adapters) {
  function authenticate(req, _res, next) {
    try {
      const header = req.headers.authorization || "";
      const token = header.startsWith("Bearer ") ? header.slice(7).trim() : null;
      const payload = verifyToken(token);
      const user = adapters.repos.users.findById(payload.sub);
      if (!user || user.active === false) {
        throw new AuthenticationError("Account is inactive or no longer exists");
      }
      req.user = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      };
      next();
    } catch (err) {
      next(err);
    }
  }

  function requireRole(...allowedRoles) {
    return (req, _res, next) => {
      if (!req.user) {
        return next(new AuthenticationError("Authentication required"));
      }
      if (!allowedRoles.includes(req.user.role)) {
        return next(
          new AuthorizationError(
            `Role "${req.user.role}" is not permitted to access this resource`
          )
        );
      }
      next();
    };
  }

  return { authenticate, requireRole };
}

module.exports = { createAuthMiddleware };

