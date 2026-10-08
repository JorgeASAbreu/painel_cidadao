import { createFavoriteRepository } from '../repositories/favoriteRepository.js';

function validSnapshot(snapshot) {
  return snapshot && typeof snapshot === 'object'
    && snapshot.location && /^\d{7}$/.test(String(snapshot.location.ibgeCode || ''))
    && typeof snapshot.location.city === 'string' && typeof snapshot.location.state === 'string'
    && snapshot.weather && snapshot.demographics;
}

export function createFavoriteController(db, locationService) {
  const favorites = createFavoriteRepository(db);
  return {
    list: (req, res) => res.json({ data: favorites.listByUser(req.user.id) }),
    detail: (req, res) => {
      const favorite = favorites.findById(req.user.id, Number(req.params.id));
      if (!favorite) return res.status(404).json({ error: { code: 'FAVORITE_NOT_FOUND', message: 'Município favorito não encontrado.' } });
      return res.json({ data: favorite });
    },
    save: (req, res) => {
      const snapshot = req.body?.snapshot;
      if (!validSnapshot(snapshot)) {
        return res.status(400).json({ error: { code: 'INVALID_SNAPSHOT', message: 'Os dados recebidos não formam um snapshot municipal válido.' } });
      }
      return res.status(201).json({ data: favorites.saveSnapshot(req.user.id, snapshot) });
    },
    refresh: async (req, res) => {
      const id = Number(req.params.id);
      const existing = favorites.findById(req.user.id, id);
      if (!existing) return res.status(404).json({ error: { code: 'FAVORITE_NOT_FOUND', message: 'Município favorito não encontrado.' } });
      const snapshot = await locationService.lookup(existing.referenceCep);
      if (!validSnapshot(snapshot)) {
        return res.status(422).json({ error: { code: 'SNAPSHOT_UNAVAILABLE', message: 'Não foi possível atualizar os dados deste município.' } });
      }
      return res.json({ data: favorites.updateSnapshot(req.user.id, id, snapshot) });
    },
    remove: (req, res) => {
      if (!favorites.deleteById(req.user.id, Number(req.params.id))) {
        return res.status(404).json({ error: { code: 'FAVORITE_NOT_FOUND', message: 'Município favorito não encontrado.' } });
      }
      return res.json({ data: { message: 'Município removido dos favoritos.' } });
    },
  };
}
