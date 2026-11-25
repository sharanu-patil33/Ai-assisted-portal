// server/src/modules/auth/authService.js
// Layer 3: Identity and Access domain service (FR-01, FR-02)

const crypto = require("crypto");
const {
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  NotFoundError,
} = require("../../models/domainErrors");

const ALLOWED_ROLES = new Set(["Student", "Teacher", "Admin"]);
const TOKEN_SECRET = process.env.AUTH_SECRET || "ai-learning-platform-dev-secret";
const TOKEN_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(":")) return false;
  const [salt, originalHex] = storedHash.split(":");
  const derived = crypto.scryptSync(password, salt, 64);
  const original = Buffer.from(originalHex, "hex");
  if (derived.length !== original.length) return false;
  return crypto.timingSafeEqual(derived, original);
}

function signToken(user) {
  const payload = {
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    exp: Date.now() + TOKEN_TTL_MS,
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = crypto
    .createHmac("sha256", TOKEN_SECRET)
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${signature}`;
}

function verifyToken(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) {
    throw new AuthenticationError("Invalid or missing authentication token");
  }
  const [encoded, signature] = token.split(".");
  const expected = crypto
    .createHmac("sha256", TOKEN_SECRET)
    .update(encoded)
    .digest("base64url");

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    throw new AuthenticationError("Invalid token signature");
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch (_err) {
    throw new AuthenticationError("Malformed token payload");
  }

  if (!payload || typeof payload.exp !== "number" || Date.now() > payload.exp) {
    throw new AuthenticationError("Session token expired");
  }
  return payload;
}

function sanitizeUser(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}

function registerUser({ name, email, password, role = "Student" }, repos) {
  if (!name || typeof name !== "string" || name.trim().length < 2) {
    throw new ValidationError("Name must be at least 2 characters");
  }
  if (!email || typeof email !== "string" || !email.includes("@")) {
    throw new ValidationError("A valid email address is required");
  }
  if (!password || typeof password !== "string" || password.length < 6) {
    throw new ValidationError("Password must be at least 6 characters");
  }
  if (!ALLOWED_ROLES.has(role)) {
    throw new ValidationError('Role must be "Student", "Teacher", or "Admin"');
  }

  const existing = repos.users.findByEmail(email.trim());
  if (existing) {
    throw new ConflictError("An account with this email already exists");
  }

  const user = {
    id: `u-${role.toLowerCase()}-${Date.now()}`,
    name: name.trim(),
    email: email.trim().toLowerCase(),
    role,
    passwordHash: hashPassword(password),
    active: true,
    createdAt: new Date().toISOString(),
  };

  repos.users.create(user);
  repos.auditLogs.create({
    id: `aud-${Date.now()}`,
    action: "USER_REGISTERED",
    actorId: user.id,
    targetId: user.id,
    details: { role: user.role },
    createdAt: new Date().toISOString(),
  });

  const token = signToken(user);
  return { user: sanitizeUser(user), token };
}

function loginUser({ email, password }, repos) {
  if (!email || !password) {
    throw new ValidationError("Email and password are required");
  }
  const user = repos.users.findByEmail(email.trim());
  if (!user || !verifyPassword(password, user.passwordHash)) {
    throw new AuthenticationError("Invalid email or password");
  }
  if (user.active === false) {
    throw new AuthorizationError("This account has been deactivated by an administrator");
  }
  const token = signToken(user);
  return { user: sanitizeUser(user), token };
}

function listUsers(actor, repos) {
  if (!actor || actor.role !== "Admin") {
    throw new AuthorizationError("Only administrators can list platform users");
  }
  return repos.users.listAll();
}

function updateUserAdmin(userId, { role, active }, actor, repos) {
  if (!actor || actor.role !== "Admin") {
    throw new AuthorizationError("Only administrators can modify user accounts");
  }
  const target = repos.users.findById(userId);
  if (!target) {
    throw new NotFoundError("User not found");
  }
  const patch = {};
  if (role !== undefined) {
    if (!ALLOWED_ROLES.has(role)) {
      throw new ValidationError('Role must be "Student", "Teacher", or "Admin"');
    }
    patch.role = role;
  }
  if (active !== undefined) {
    patch.active = Boolean(active);
  }
  const updated = repos.users.update(userId, patch);
  repos.auditLogs.create({
    id: `aud-${Date.now()}`,
    action: "USER_UPDATED_BY_ADMIN",
    actorId: actor.id,
    targetId: userId,
    details: patch,
    createdAt: new Date().toISOString(),
  });
  return sanitizeUser(updated);
}

function listAuditLogs(actor, repos) {
  if (!actor || actor.role !== "Admin") {
    throw new AuthorizationError("Only administrators can inspect audit logs");
  }
  return repos.auditLogs.list(100);
}

module.exports = {
  registerUser,
  loginUser,
  signToken,
  verifyToken,
  listUsers,
  updateUserAdmin,
  listAuditLogs,
  sanitizeUser,
};

