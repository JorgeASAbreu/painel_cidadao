const BRAZILIAN_STATES = new Set([
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]);

export function createMapController(mapTileProvider, reverseGeocodeProvider, citySearchProvider = reverseGeocodeProvider?.searchCity) {
  return {
    tile: async (req, res) => {
      const z = Number(req.params.z);
      const x = Number(req.params.x);
      const y = Number(req.params.y);
      if (![z, x, y].every(Number.isSafeInteger) || z < 0 || z > 19) {
        return res.status(400).json({ error: { code: 'INVALID_MAP_TILE', message: 'Coordenadas de mapa inválidas.' } });
      }
      const tileCount = 2 ** z;
      if (x < 0 || y < 0 || x >= tileCount || y >= tileCount) {
        return res.status(400).json({ error: { code: 'INVALID_MAP_TILE', message: 'Coordenadas de mapa inválidas.' } });
      }

      try {
        const tile = await mapTileProvider({ z, x, y });
        res.status(200).type(tile.contentType).set('Cache-Control', tile.cacheControl);
        if (tile.expires) res.set('Expires', tile.expires);
        if (tile.etag) res.set('ETag', tile.etag);
        return res.send(tile.body);
      } catch {
        return res.status(502).json({ error: { code: 'MAP_TILE_UNAVAILABLE', message: 'O mapa está temporariamente indisponível.' } });
      }
    },
    reverse: async (req, res) => {
      const { latitude, longitude } = req.body || {};
      if (typeof latitude !== 'number' || typeof longitude !== 'number'
        || !Number.isFinite(latitude) || !Number.isFinite(longitude)
        || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
        return res.status(400).json({ error: { code: 'INVALID_COORDINATES', message: 'Selecione um ponto válido no mapa.' } });
      }

      try {
        const result = await reverseGeocodeProvider({ latitude, longitude });
        if (!result || !/^\d{8}$/.test(String(result.cep || ''))) {
          return res.status(404).json({ error: { code: 'POSTAL_CODE_NOT_FOUND', message: 'Não foi encontrado um CEP associado a este ponto do mapa.' } });
        }
        return res.json({ data: { cep: String(result.cep) } });
      } catch {
        return res.status(502).json({ error: { code: 'REVERSE_GEOCODING_UNAVAILABLE', message: 'Não foi possível localizar um CEP neste momento.' } });
      }
    },
    cityCenters: async (req, res) => {
      const city = typeof req.body?.city === 'string' ? req.body.city.trim() : '';
      const state = typeof req.body?.state === 'string' ? req.body.state.trim().toUpperCase() : '';
      if (city.length < 2 || city.length > 100 || !/^[\p{L}\p{M} .'-]+$/u.test(city)
        || !BRAZILIAN_STATES.has(state)) {
        return res.status(400).json({ error: { code: 'INVALID_CITY_QUERY', message: 'Informe um município e uma UF válidos.' } });
      }

      try {
        const result = await citySearchProvider({ city, state });
        if (!result?.geographicCenter) {
          return res.status(404).json({ error: { code: 'CITY_NOT_FOUND', message: 'Não foi possível localizar o centro deste município no OpenStreetMap.' } });
        }
        return res.json({ data: result });
      } catch {
        return res.status(502).json({ error: { code: 'CITY_SEARCH_UNAVAILABLE', message: 'A busca geográfica da cidade está temporariamente indisponível.' } });
      }
    },
  };
}
