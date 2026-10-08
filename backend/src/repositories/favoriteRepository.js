export function createFavoriteRepository(db) {
  const selectFavorite = db.prepare(`
    SELECT id, user_id AS userId, ibge_code AS ibgeCode, city_name AS cityName,
      state_code AS stateCode, reference_cep AS referenceCep, snapshot_json AS snapshotJson,
      snapshot_at AS snapshotAt, created_at AS createdAt, updated_at AS updatedAt
    FROM favorites WHERE id = ? AND user_id = ?
  `);

  function deserialize(row) {
    if (!row) return null;
    const { snapshotJson, ...favorite } = row;
    return { ...favorite, snapshot: JSON.parse(snapshotJson) };
  }

  return {
    listByUser(userId) {
      return db.prepare(`
        SELECT id, ibge_code AS ibgeCode, city_name AS cityName, state_code AS stateCode,
          reference_cep AS referenceCep, snapshot_at AS snapshotAt, created_at AS createdAt, updated_at AS updatedAt
        FROM favorites WHERE user_id = ? ORDER BY city_name COLLATE NOCASE
      `).all(userId);
    },
    findById(userId, id) {
      return deserialize(selectFavorite.get(id, userId));
    },
    findByMunicipality(userId, ibgeCode) {
      const row = db.prepare('SELECT id FROM favorites WHERE user_id = ? AND ibge_code = ?').get(userId, ibgeCode);
      return row ? this.findById(userId, row.id) : null;
    },
    saveSnapshot(userId, snapshot) {
      const now = new Date().toISOString();
      const location = snapshot.location;
      const snapshotAt = snapshot.collectedAt || now;
      db.prepare(`
        INSERT INTO favorites (user_id, ibge_code, city_name, state_code, reference_cep, snapshot_json, snapshot_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, ibge_code) DO UPDATE SET
          city_name = excluded.city_name,
          state_code = excluded.state_code,
          reference_cep = excluded.reference_cep,
          snapshot_json = excluded.snapshot_json,
          snapshot_at = excluded.snapshot_at,
          updated_at = excluded.updated_at
      `).run(userId, location.ibgeCode, location.city, location.state, location.cep || null,
        JSON.stringify(snapshot), snapshotAt, now, now);
      return this.findByMunicipality(userId, location.ibgeCode);
    },
    updateSnapshot(userId, id, snapshot) {
      if (!selectFavorite.get(id, userId)) return null;
      const now = new Date().toISOString();
      const location = snapshot.location;
      db.prepare(`
        UPDATE favorites SET ibge_code = ?, city_name = ?, state_code = ?, reference_cep = ?,
          snapshot_json = ?, snapshot_at = ?, updated_at = ? WHERE id = ? AND user_id = ?
      `).run(location.ibgeCode, location.city, location.state, location.cep || null,
        JSON.stringify(snapshot), snapshot.collectedAt || now, now, id, userId);
      return this.findById(userId, id);
    },
    deleteById(userId, id) {
      return db.prepare('DELETE FROM favorites WHERE id = ? AND user_id = ?').run(id, userId).changes > 0;
    },
  };
}
