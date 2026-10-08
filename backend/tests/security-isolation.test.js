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
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'painel-seguranca-'));
  temporaryDirectories.push(directory);
  const db = createDatabase(path.join(directory, 'painel.sqlite'));
  openDatabases.push(db);
  return db;
}

function municipalSnapshot() {
  return {
    location: {
      cep: '35160000', street: 'Avenida exemplo', district: 'Centro', city: 'Ipatinga', state: 'MG',
      ibgeCode: '3131307', latitude: -19.4686, longitude: -42.5367,
    },
    weather: { status: 'available', temperatureC: 24, condition: 'Nublado', observedAt: '2026-10-08T12:00' },
    demographics: {
      population: { status: 'available', value: 227731, year: 2025, source: 'IBGE', sourceUrl: 'https://servicodados.ibge.gov.br/' },
      density: { status: 'available', value: 1419.8, year: 2022, source: 'IBGE', sourceUrl: 'https://servicodados.ibge.gov.br/' },
    },
    collectedAt: '2026-10-08T12:00:00.000Z', status: 'available', warnings: [],
  };
}

async function registerAndLogin(agent, name, email, password) {
  const registration = await agent.post('/api/auth/register').send({ name, email, password, confirmPassword: password }).expect(201);
  expect(registration.body.data).not.toHaveProperty('password');
  expect(registration.body.data).not.toHaveProperty('passwordHash');
  return agent.post('/api/auth/login').send({ email, password }).expect(200);
}

afterEach(() => {
  for (const db of openDatabases) {
    try { db.close(); } catch {}
  }
  openDatabases = [];
  for (const directory of temporaryDirectories.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

describe('segurança de sessão e isolamento de favoritos', () => {
  it('exige sessão, impede acesso cruzado por ID e invalida o cookie no logout', async () => {
    const db = createTempDatabase();
    const locationService = { lookup: vi.fn(async () => municipalSnapshot()) };
    const app = createApp({ db, locationService });
    const anonymous = request(app);
    const validSnapshot = municipalSnapshot();

    await anonymous.get('/api/locations/cep/35160-000').expect(401);
    await anonymous.get('/api/favorites').expect(401);
    await anonymous.get('/api/favorites/1').expect(401);
    await anonymous.post('/api/favorites').send({ snapshot: validSnapshot }).expect(401);
    await anonymous.put('/api/favorites/1/refresh').expect(401);
    await anonymous.delete('/api/favorites/1').expect(401);
    expect(locationService.lookup).not.toHaveBeenCalled();

    const userA = request.agent(app);
    const loginA = await registerAndLogin(userA, 'Ana', 'ana@example.test', 'senha-ana-123');
    const cookieA = loginA.headers['set-cookie'].find((cookie) => cookie.startsWith('painel_session='));
    expect(cookieA).toMatch(/HttpOnly/i);
    expect(cookieA).toMatch(/SameSite=Lax/i);
    expect(cookieA).toMatch(/Max-Age=604800/i);
    expect(loginA.body.data).not.toHaveProperty('password');
    expect(loginA.body.data).not.toHaveProperty('passwordHash');
    const sessionUser = await userA.get('/api/auth/me').expect(200);
    expect(sessionUser.body.data).toMatchObject({ id: loginA.body.data.id, email: 'ana@example.test' });
    expect(sessionUser.body.data).not.toHaveProperty('passwordHash');
    expect(sessionUser.body.data).not.toHaveProperty('sessionId');
    await request(app).post('/api/auth/login').send({ email: "' OR '1'='1' --", password: 'senha-ana-123' }).expect(401);
    expect(db.prepare('SELECT COUNT(*) AS count FROM sessions').get().count).toBe(1);

    const rawSessionToken = decodeURIComponent(cookieA.match(/painel_session=([^;]+)/)[1]);
    const storedSession = db.prepare('SELECT id_hash FROM sessions').get();
    expect(storedSession.id_hash).not.toBe(rawSessionToken);
    const storedPassword = db.prepare('SELECT password_hash FROM users WHERE email = ?').get('ana@example.test').password_hash;
    expect(storedPassword).not.toBe('senha-ana-123');

    const lookup = await userA.get('/api/locations/cep/35160-000').expect(200);
    expect(lookup.body.data.location.city).toBe('Ipatinga');
    expect(db.prepare('SELECT COUNT(*) AS count FROM favorites').get().count).toBe(0);

    const saved = await userA.post('/api/favorites').send({ snapshot: lookup.body.data }).expect(201);
    const favoriteId = saved.body.data.id;
    expect((await userA.get('/api/favorites').expect(200)).body.data).toHaveLength(1);

    const userB = request.agent(app);
    const loginB = await registerAndLogin(userB, 'Bruno', 'bruno@example.test', 'senha-bruno-123');
    expect(loginB.body.data.id).not.toBe(loginA.body.data.id);
    expect((await userB.get('/api/favorites').expect(200)).body.data).toEqual([]);

    const snapshotB = {
      ...validSnapshot,
      location: { ...validSnapshot.location, cep: '01001000', city: 'São Paulo', state: 'SP', ibgeCode: '3550308' },
    };
    const savedByB = await userB.post('/api/favorites').send({ snapshot: snapshotB }).expect(201);
    const favoriteIdB = savedByB.body.data.id;
    expect(favoriteIdB).not.toBe(favoriteId);
    expect((await userB.get('/api/favorites').expect(200)).body.data.map((item) => item.cityName)).toEqual(['São Paulo']);
    expect((await userA.get('/api/favorites').expect(200)).body.data.map((item) => item.cityName)).toEqual(['Ipatinga']);
    await userA.get(`/api/favorites/${favoriteIdB}`).expect(404);

    await userB.get(`/api/favorites/${favoriteId}`).expect(404);
    await userB.put(`/api/favorites/${favoriteId}/refresh`).expect(404);
    await userB.delete(`/api/favorites/${favoriteId}`).expect(404);
    expect(locationService.lookup).toHaveBeenCalledTimes(1);
    expect((await userA.get(`/api/favorites/${favoriteId}`).expect(200)).body.data.snapshot.location.city).toBe('Ipatinga');
    expect((await userA.get('/api/favorites').expect(200)).body.data).toHaveLength(1);

    await userA.post('/api/auth/logout').expect(200);
    expect((await userA.get('/api/auth/me').expect(200)).body.data).toBeNull();
    await request(app).get('/api/favorites').set('Cookie', cookieA.split(';')[0]).expect(401);
    await request(app).get('/api/favorites/1').set('Cookie', cookieA.split(';')[0]).expect(401);
    await request(app).get('/api/locations/cep/35160-000').set('Cookie', cookieA.split(';')[0]).expect(401);
  });

  it('responde com erro genérico sem devolver detalhes internos do provedor', async () => {
    const db = createTempDatabase();
    const privateProviderDetail = 'INTERNAL_PROVIDER_DETAIL_NOT_FOR_CLIENT';
    const locationService = { lookup: vi.fn(async () => { throw new Error(privateProviderDetail); }) };
    const app = createApp({ db, locationService });
    const user = request.agent(app);
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      await registerAndLogin(user, 'Ana', 'ana@example.test', 'senha-ana-123');
      const response = await user.get('/api/locations/cep/35160-000').expect(500);
      const responseText = JSON.stringify(response.body);
      expect(response.body.error.code).toBe('INTERNAL_ERROR');
      expect(response.body.error.message).toBe('Não foi possível concluir a solicitação.');
      expect(responseText).not.toContain(privateProviderDetail);
      expect(responseText).not.toMatch(/stack|node_modules|\.js:\d+/i);
    } finally {
      errorLog.mockRestore();
    }
  });
});
