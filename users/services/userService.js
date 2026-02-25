const UserRepository = require('../repositories/userRepository');

const userRepo = new UserRepository();

async function createUser(username) {
  if (!username) {
    throw new Error('Username is required');
  }
  try {
    const userId = await userRepo.insertUser(username);
    return `Hello ${username}! Welcome to the course! User created with ID: ${userId}`;
  } catch (err) {
    throw new Error('Database error: ' + err.message);
  }
}

module.exports = { createUser };