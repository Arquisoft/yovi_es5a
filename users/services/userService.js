const UserRepository = require('../repositories/userRepository');

const userRepo = new UserRepository();

// Funciones auxiliares para crear errores de servicio con código y mensaje
function createServiceError(message, code, statusCode = 400) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

async function createUser(username, email, password) {
  if (!username) {
    throw createServiceError('Username is required', 'MISSING_USERNAME', 400);
  }
  try {
    const connection = await userRepo.getConnection();
    const userId = await userRepo.insertUser(username, email, password, connection);
    return `Hello ${username}! Welcome to the course! User created with ID: ${userId}`;
  } catch (err) {
    throw createServiceError('Database error', 'DATABASE_ERROR', 500);
  }
}

async function getUserByUsername(username) {
  const conn = await userRepo.getConnection();
  const users = await userRepo.getUsersFromDB(conn);
  return users.find(user => user.username === username);
}

async function resolveUserByExactUsername(username) {
  const normalized = String(username || '').trim();
  if (!normalized) {
    return null;
  }
  return userRepo.findUserByUsernameExact(normalized);
}

async function resolveUserByExactEmail(email) {
  const normalized = String(email || '').trim();
  if(!normalized) {
    return null;
  }
  return userRepo.findUserByEmailExact(normalized);
}

module.exports = { 
  userRepo,
  createUser,
  resolveUserByExactUsername,
  resolveUserByExactEmail,
  getUserByUsername
};