// server/src/middleware/errorHandler.js
// Layer 2: Maps Domain Errors and validation errors to consistent JSON responses (ADR-003, AFM-4)

const {
  DomainError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  OutOfScopeError,
} = require("../models/domainErrors");

function mapStatusCode(err) {
  if (err instanceof ValidationError) return 400;
  if (err instanceof AuthenticationError) return 401;
  if (err instanceof AuthorizationError) return 403;
  if (err instanceof NotFoundError) return 404;
  if (err instanceof ConflictError) return 409;
  if (err instanceof OutOfScopeError) return 422;
  if (err instanceof TypeError) return 400;
  if (err && err.name === "MulterError") return 400;
  return 500;
}

function errorHandler(err, _req, res, _next) {
  const status = mapStatusCode(err);
  const code =
    err instanceof DomainError
      ? err.code
      : err instanceof TypeError
      ? "INVALID_INPUT"
      : err && err.name === "MulterError"
      ? "FILE_UPLOAD_ERROR"
      : "INTERNAL_ERROR";

  const message =
    status === 500 && process.env.NODE_ENV === "production"
      ? "An unexpected server error occurred"
      : err && err.message
      ? err.message
      : "Unexpected error";

  res.status(status).json({
    error: {
      code,
      message,
      details: err && err.details ? err.details : null,
    },
  });
}

module.exports = { errorHandler };

