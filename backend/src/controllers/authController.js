import { hashPassword, verifyPassword } from '../utils/passwords.js';
import { startSession, endSession } from '../middleware/session.js';
import { createUserRepository } from '../repositories/userRepository.js';

export function createAuthController(db) {
  const users = createUserRepository(db);
  return {
    register: async (req, res) => {
      const { name, email, password, confirmPassword } = req.body || {};
      const normalizedName = typeof name === 'string' ? name.trim() : '';
      const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
      if (!normalizedName || !/^\S+@\S+\.\S+$/.test(normalizedEmail) || typeof password !== 'string' || password.length < 8) {
        return res.status(400).json({ error: { code: 'INVALID_REGISTRATION', message: 'Informe nome, e-mail válido e senha com pelo menos 8 caracteres.' } });
      }
      if (confirmPassword !== undefined && confirmPassword !== password) {
        return res.status(400).json({ error: { code: 'PASSWORD_MISMATCH', message: 'As senhas informadas não coincidem.' } });
      }
      if (users.findByEmail(normalizedEmail)) {
        return res.status(409).json({ error: { code: 'EMAIL_ALREADY_EXISTS', message: 'Este e-mail já possui uma conta.' } });
      }

      const passwordHash = await hashPassword(password);
      try {
        const user = users.create({ name: normalizedName, email: normalizedEmail, passwordHash, createdAt: new Date().toISOString() });
        return res.status(201).json({ data: user });
      } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
          return res.status(409).json({ error: { code: 'EMAIL_ALREADY_EXISTS', message: 'Este e-mail já possui uma conta.' } });
        }
        throw error;
      }
    },
    login: async (req, res) => {
      const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      const password = typeof req.body?.password === 'string' ? req.body.password : '';
      const userWithHash = users.findByEmail(email);
      if (!userWithHash || !(await verifyPassword(password, userWithHash.passwordHash))) {
        return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'E-mail ou senha não conferem.' } });
      }
      startSession(db, res, userWithHash.id);
      return res.json({ data: users.findPublicById(userWithHash.id) });
    },
    me: (req, res) => res.json({ data: req.user }),
    logout: (req, res) => {
      endSession(db, req, res);
      return res.json({ data: { message: 'Sessão encerrada.' } });
    },
  };
}
