import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../src/app.js';
import { createDatabase } from '../src/database/database.js';

const temporaryDirectories = [];
let openDatabases = [];

function createTempDatabase() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'painel-civico-'));
  temporaryDirectories.push(directory);
  const filename = path.join(directory, 'painel.sqlite');
  const db = createDatabase(filename);
  openDatabases.push(db);
  return { db, filename };
}

function municipalSnapshot(overrides = {}) {
  const collectedAt = overrides.collectedAt || '2026-10-08T12:00:00.000Z';
  return {
    location: {
      cep: '01001000', street: 'Praça da Sé', district: 'Sé', city: 'São Paulo', state: 'SP',
      ibgeCode: '3550308', latitude: -23.5475, longitude: -46.63611, regionCode: 'SE',
      region: { id: 3, sigla: 'SE', nome: 'Sudeste' },
    },
    weather: {
      status: 'available', temperatureC: 25.2, humidityPercent: 63, windKmh: 3.4,
      weatherCode: 1, condition: 'Predominantemente limpo', observedAt: '2026-10-08T09:00',
      source: 'Open-Meteo', sourceUrl: 'https://api.open-meteo.com/v1/forecast?latitude=-23.5475&longitude=-46.63611',
    },
    demographics: {
      population: { status: 'available', value: 11904961, unit: 'pessoas', year: 2025, source: 'IBGE', sourceName: 'Estimativas de População', table: '6579', variable: '9324', sourceUrl: 'https://servicodados.ibge.gov.br/api/v3/agregados/6579' },
      density: { status: 'available', value: 7528.26, unit: 'hab/km²', year: 2022, source: 'IBGE', sourceName: 'Censo Demográfico', table: '4714', variable: '614', sourceUrl: 'https://servicodados.ibge.gov.br/api/v3/agregados/4714' },
    },
    collectedAt,
    status: 'available',
    warnings: [],
    ...overrides,
  };
}

afterEach(() => {
  for (const db of openDatabases) {
    try { db.close(); } catch {}
  }
  openDatabases = [];
  for (const directory of temporaryDirectories.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

describe('caminho feliz municipal', () => {
  it('cadastra, autentica, consulta, favorita, preserva offline, atualiza, isola usuários, remove e encerra sessão', async () => {
    const { db, filename } = createTempDatabase();
    const locationService = { lookup: vi.fn(async () => municipalSnapshot()) };
    const mapTileProvider = vi.fn(async () => ({
      body: Buffer.from([137, 80, 78, 71]), contentType: 'image/png', cacheControl: 'public, max-age=3600',
    }));
    const reverseGeocodeProvider = vi.fn(async () => ({ cep: '01001000' }));
    const citySearchProvider = vi.fn(async ({ city, state }) => ({
      city, state,
      geographicCenter: { name: city, latitude: -23.55, longitude: -46.63, cep: '01001000' },
      civicCenter: { name: 'Prefeitura Municipal', latitude: -23.54, longitude: -46.62, cep: '01002000' },
      source: 'OpenStreetMap / Nominatim',
    }));
    const app = createApp({ db, locationService, mapTileProvider, reverseGeocodeProvider, citySearchProvider });
    const userA = request.agent(app);

    const health = await userA.get('/api/health').expect(200);
    expect(health.body.data.status).toBe('ok');

    await userA.post('/api/auth/register').send({
      name: 'Ana Cidadã', email: 'ANA@example.test', password: 'senha-local-123', confirmPassword: 'senha-local-123',
    }).expect(201);
    const storedUser = db.prepare('SELECT email, password_hash FROM users').get();
    expect(storedUser.email).toBe('ana@example.test');
    expect(storedUser.password_hash).not.toBe('senha-local-123');

    const login = await userA.post('/api/auth/login').send({ email: 'ana@example.test', password: 'senha-local-123' }).expect(200);
    const sessionCookie = login.headers['set-cookie'][0].split(';')[0];
    expect(login.body.data.name).toBe('Ana Cidadã');

    const mapTile = await userA.get('/api/map/tiles/16/19315/27328.png').expect(200).expect('Content-Type', /image\/png/);
    expect(mapTile.body).toEqual(Buffer.from([137, 80, 78, 71]));
    expect(mapTileProvider).toHaveBeenCalledWith({ z: 16, x: 19315, y: 27328 });
    const reverseGeocode = await userA.post('/api/map/reverse').send({ latitude: -23.5475, longitude: -46.63611 }).expect(200);
    expect(reverseGeocode.body.data.cep).toBe('01001000');
    expect(reverseGeocodeProvider).toHaveBeenCalledWith({ latitude: -23.5475, longitude: -46.63611 });
    const citySearch = await userA.post('/api/map/city-centers').send({ city: 'São Paulo', state: 'SP' }).expect(200);
    expect(citySearch.body.data.geographicCenter.cep).toBe('01001000');
    expect(citySearch.body.data.civicCenter.cep).toBe('01002000');
    expect(citySearchProvider).toHaveBeenCalledWith({ city: 'São Paulo', state: 'SP' });

    const lookup = await userA.get('/api/locations/cep/01001-000').expect(200);
    expect(lookup.body.data.location.ibgeCode).toBe('3550308');
    expect(lookup.body.data.weather.temperatureC).toBe(25.2);
    expect(lookup.body.data.demographics.population.year).toBe(2025);
    expect(db.prepare('SELECT COUNT(*) AS count FROM favorites').get().count).toBe(0);

    const saved = await userA.post('/api/favorites').send({ snapshot: lookup.body.data }).expect(201);
    const favoriteId = saved.body.data.id;
    expect(saved.body.data.snapshot.location.city).toBe('São Paulo');
    expect((await userA.get('/api/favorites').expect(200)).body.data).toHaveLength(1);

    locationService.lookup.mockRejectedValue(new Error('rede externa indisponível'));
    const detailOffline = await userA.get(`/api/favorites/${favoriteId}`).expect(200);
    expect(detailOffline.body.data.snapshot.weather.status).toBe('available');
    expect(detailOffline.body.data.snapshotAt).toBe('2026-10-08T12:00:00.000Z');
    expect(locationService.lookup).toHaveBeenCalledTimes(1);

    db.close();
    const restartedDb = createDatabase(filename);
    openDatabases.push(restartedDb);
    const restartedApp = createApp({ db: restartedDb, locationService });
    const persisted = await request(restartedApp).get('/api/favorites').set('Cookie', sessionCookie).expect(200);
    expect(persisted.body.data).toHaveLength(1);
    expect(persisted.body.data[0].cityName).toBe('São Paulo');

    const userB = request.agent(restartedApp);
    await userB.post('/api/auth/register').send({
      name: 'Bruno', email: 'bruno@example.test', password: 'senha-local-456', confirmPassword: 'senha-local-456',
    }).expect(201);
    await userB.post('/api/auth/login').send({ email: 'bruno@example.test', password: 'senha-local-456' }).expect(200);
    expect((await userB.get('/api/favorites').expect(200)).body.data).toEqual([]);

    locationService.lookup.mockResolvedValue(municipalSnapshot({ collectedAt: '2026-10-08T13:00:00.000Z' }));
    const refreshed = await request(restartedApp).put(`/api/favorites/${favoriteId}/refresh`).set('Cookie', sessionCookie).expect(200);
    expect(refreshed.body.data.snapshotAt).toBe('2026-10-08T13:00:00.000Z');
    expect(locationService.lookup).toHaveBeenCalledTimes(2);

    await request(restartedApp).delete(`/api/favorites/${favoriteId}`).set('Cookie', sessionCookie).expect(200);
    expect((await request(restartedApp).get('/api/favorites').set('Cookie', sessionCookie).expect(200)).body.data).toEqual([]);
    await request(restartedApp).post('/api/auth/logout').set('Cookie', sessionCookie).expect(200);
    expect((await request(restartedApp).get('/api/auth/me').set('Cookie', sessionCookie).expect(200)).body.data).toBeNull();
  });
});
