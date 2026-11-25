// server/src/models/domainErrors.js
// Pure domain errors for Layer 3 (no HTTP or Express dependencies)

class DomainError extends Error {
  constructor(code, message, details = null) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
  }
}

class ValidationError extends DomainError {
  constructor(message, details = null) {
    super("VALIDATION_ERROR", message, details);
  }
}

class AuthenticationError extends DomainError {
  constructor(message = "Authentication required", details = null) {
    super("AUTHENTICATION_ERROR", message, details);
  }
}

class AuthorizationError extends DomainError {
  constructor(message = "Access denied", details = null) {
    super("AUTHORIZATION_ERROR", message, details);
  }
}

class NotFoundError extends DomainError {
  constructor(message = "Resource not found", details = null) {
    super("NOT_FOUND", message, details);
  }
}

class ConflictError extends DomainError {
  constructor(message = "Conflict detected", details = null) {
    super("CONFLICT", message, details);
  }
}

class OutOfScopeError extends DomainError {
  constructor(message = "Question is outside the course material", details = null) {
    super("OUT_OF_SCOPE", message, details);
  }
}

module.exports = {
  DomainError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  OutOfScopeError,
};

