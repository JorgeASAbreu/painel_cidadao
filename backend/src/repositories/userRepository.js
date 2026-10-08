export function createUserRepository(db) {
  return {
    findByEmail(email) {
      return db.prepare('SELECT id, name, email, password_hash AS passwordHash FROM users WHERE email = ?').get(email) || null;
    },
    findPublicById(id) {
      return db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(id) || null;
    },
    create({ name, email, passwordHash, createdAt }) {
      const result = db.prepare('INSERT INTO users (name, email, password_hash, created_at) VALUES (?, ?, ?, ?)')
        .run(name, email, passwordHash, createdAt);
      return this.findPublicById(Number(result.lastInsertRowid));
    },
  };
}
