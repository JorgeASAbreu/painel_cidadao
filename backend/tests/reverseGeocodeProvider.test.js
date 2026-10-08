import { describe, expect, it, vi } from 'vitest';
import { createReverseGeocodeProvider } from '../src/providers/reverseGeocodeProvider.js';

describe('provedor de busca reversa do mapa', () => {
  it('normaliza e mantém em cache o CEP brasileiro retornado pelo Nominatim', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ address: { postcode: '01001-000' } }),
    }));
    const reverseGeocode = createReverseGeocodeProvider({
      fetchImpl,
      reverseEndpoint: 'https://nominatim.example.test/reverse',
    });
    const coordinates = { latitude: -23.5475, longitude: -46.63611 };

    await expect(reverseGeocode(coordinates)).resolves.toEqual({ cep: '01001000' });
    await expect(reverseGeocode(coordinates)).resolves.toEqual({ cep: '01001000' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [requestUrl, options] = fetchImpl.mock.calls[0];
    const parsedUrl = new URL(requestUrl);
    expect(parsedUrl.searchParams.get('format')).toBe('jsonv2');
    expect(parsedUrl.searchParams.get('countrycodes')).toBe('br');
    expect(parsedUrl.searchParams.get('lat')).toBe('-23.5475');
    expect(parsedUrl.searchParams.get('lon')).toBe('-46.63611');
    expect(options.headers['User-Agent']).toContain('PainelCivicoMunicipal');
  });

  it('encontra o centro municipal e a prefeitura sem depender de coordenadas inventadas', async () => {
    const fetchImpl = vi.fn(async (requestUrl) => {
      const url = new URL(requestUrl);
      if (url.searchParams.get('q').startsWith('prefeitura de')) {
        return {
          ok: true,
          json: async () => [{
            name: 'Prefeitura Municipal', type: 'townhall', lat: '-23.54', lon: '-46.62', importance: 0.8,
            address: { city: 'São Paulo', state: 'São Paulo', postcode: '01002-000' },
          }],
        };
      }
      return {
        ok: true,
        json: async () => [{
          name: 'São Paulo', type: 'administrative', lat: '-23.55', lon: '-46.63', importance: 0.9,
          address: { city: 'São Paulo', state: 'São Paulo', postcode: '01001-000' },
        }],
      };
    });
    const provider = createReverseGeocodeProvider({
      fetchImpl,
      searchEndpoint: 'https://nominatim.example.test/search',
      reverseEndpoint: 'https://nominatim.example.test/reverse',
    });
    vi.useFakeTimers();
    try {
      const resultPromise = provider.searchCity({ city: 'São Paulo', state: 'SP' });
      await vi.runAllTimersAsync();
      const result = await resultPromise;
      expect(result).toMatchObject({
        city: 'São Paulo', state: 'SP',
        geographicCenter: { latitude: -23.55, longitude: -46.63, cep: '01001000' },
        civicCenter: { name: 'Prefeitura Municipal', latitude: -23.54, longitude: -46.62, cep: '01002000' },
      });
      expect(fetchImpl).toHaveBeenCalledTimes(2);
      expect(fetchImpl.mock.calls.every(([, options]) => options.headers['User-Agent'].includes('PainelCivicoMunicipal'))).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
