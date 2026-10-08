import { describe, expect, it, vi } from 'vitest';
import { createSmallBodyObservabilityProvider } from '../src/providers/smallBodyObservabilityProvider.js';

describe('provedor NASA/JPL de pequenos corpos observáveis', () => {
  it('consulta a noite/localidade, aplica o filtro NEO e normaliza as linhas pelo cabeçalho recebido', async () => {
    const payload = {
      signature: { version: '1.0', source: 'NASA/JPL Small-Body Observability API' },
      total_objects: '87',
      shown_objects: '1',
      obs_night: { sun_set: '2026-10-08 21:12', sun_rise: '2026-10-09 09:44', dark_time: '08:01' },
      fields: ['Designation', 'Full name', 'Rise time', 'Transit time', 'Set time', 'Max. time observable', 'R.A.', 'Dec.', 'Vmag'],
      data: [['433', '433 Eros', '22:10', '01:20', '04:35', '03:12', '01:02:33', '+10 15\'00"', '10.4']],
    };
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => payload }));
    const findObservableBodies = createSmallBodyObservabilityProvider({ fetchImpl });

    const result = await findObservableBodies({
      latitude: -23.55, longitude: -46.63, date: '2026-10-08', nearEarthOnly: true,
    });

    const [url] = fetchImpl.mock.calls[0];
    expect(url.origin + url.pathname).toBe('https://ssd-api.jpl.nasa.gov/sbwobs.api');
    expect(url.searchParams.get('lat')).toBe('-23.55');
    expect(url.searchParams.get('lon')).toBe('-46.63');
    expect(url.searchParams.get('obs-time')).toBe('2026-10-08_23:00:00');
    expect(url.searchParams.get('sb-group')).toBe('neo');
    expect(url.searchParams.get('maxoutput')).toBe('25');
    expect(result).toMatchObject({
      version: '1.0', totalObjects: 87, shownObjects: 1, nearEarthOnly: true,
      night: { dark_time: '08:01' },
      objects: [{ Designation: '433', 'Full name': '433 Eros', Vmag: '10.4' }],
    });
  });
});
