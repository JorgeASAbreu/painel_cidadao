export function createAstronomyController(observabilityProvider) {
  return {
    observability: async (req, res) => {
      const { latitude, longitude, date, nearEarthOnly = false } = req.body || {};
      if (typeof latitude !== 'number' || typeof longitude !== 'number'
        || !Number.isFinite(latitude) || !Number.isFinite(longitude)
        || Math.abs(latitude) > 90 || Math.abs(longitude) > 180
        || !isValidDate(date) || typeof nearEarthOnly !== 'boolean') {
        return res.status(400).json({ error: { code: 'INVALID_OBSERVABILITY_QUERY', message: 'Informe coordenadas, data e filtro válidos para a observação.' } });
      }

      try {
        const data = await observabilityProvider({ latitude, longitude, date, nearEarthOnly });
        return res.json({ data });
      } catch {
        return res.status(502).json({ error: { code: 'OBSERVABILITY_UNAVAILABLE', message: 'Não foi possível consultar os pequenos corpos observáveis nesta noite.' } });
      }
    },
  };
}

function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
