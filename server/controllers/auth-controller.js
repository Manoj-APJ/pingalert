import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db/index.js';
import { config } from '../config/index.js';

/**
 * Handle user registration (Sign up)
 */
export const register = async (req, res) => {
  const { email, password, name } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Name, email, and password are required.' });
  }

  try {
    const emailLower = email.toLowerCase().trim();
    
    // Check if user already exists
    const userCheck = await query('SELECT id FROM users WHERE email = $1', [emailLower]);
    if (userCheck.rowCount > 0) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Insert user into PostgreSQL
    const insertRes = await query(
      `INSERT INTO users (email, password_hash, name, created_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING id, email, name, created_at`,
      [emailLower, passwordHash, name]
    );

    const user = insertRes.rows[0];

    // Sign JWT
    const token = jwt.sign({ id: user.id }, config.jwtSecret, {
      expiresIn: config.jwtExpiresIn
    });

    res.status(201).json({ token, user });
  } catch (error) {
    console.error('[Auth Controller] Signup error:', error);
    res.status(500).json({ error: 'Internal server error during registration.' });
  }
};

/**
 * Handle user login
 */
export const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const emailLower = email.toLowerCase().trim();

    // Query user
    const userRes = await query('SELECT * FROM users WHERE email = $1', [emailLower]);
    if (userRes.rowCount === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = userRes.rows[0];

    // Validate password match
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Sign JWT
    const token = jwt.sign({ id: user.id }, config.jwtSecret, {
      expiresIn: config.jwtExpiresIn
    });

    // Remove hashed password from user object
    delete user.password_hash;

    res.json({ token, user });
  } catch (error) {
    console.error('[Auth Controller] Login error:', error);
    res.status(500).json({ error: 'Internal server error during login.' });
  }
};

/**
 * Retrieve authenticated user profile info
 */
export const me = async (req, res) => {
  try {
    const userRes = await query(
      'SELECT id, email, name, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    
    if (userRes.rowCount === 0) {
      return res.status(404).json({ error: 'User profile not found.' });
    }

    res.json(userRes.rows[0]);
  } catch (error) {
    console.error('[Auth Controller] Me query error:', error);
    res.status(500).json({ error: 'Internal server error fetching profile.' });
  }
};
