const OPENSTREETMAP_TILE_ORIGIN = 'https://tile.openstreetmap.org';

export function createMapTileProvider({ fetchImpl = fetch, timeoutMs = 9000 } = {}) {
  return async function getTile({ z, x, y }) {
    const response = await fetchImpl(`${OPENSTREETMAP_TILE_ORIGIN}/${z}/${x}/${y}.png`, {
      headers: { 'User-Agent': 'PainelCivicoMunicipal/1.0' },
      redirect: 'error',
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) throw new Error(`OpenStreetMap respondeu com HTTP ${response.status}.`);
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.toLowerCase().startsWith('image/png')) {
      throw new Error('OpenStreetMap retornou um formato de tile inesperado.');
    }

    return {
      body: Buffer.from(await response.arrayBuffer()),
      contentType: 'image/png',
      cacheControl: response.headers.get('cache-control') || 'public, max-age=3600',
      expires: response.headers.get('expires'),
      etag: response.headers.get('etag'),
    };
  };
}
