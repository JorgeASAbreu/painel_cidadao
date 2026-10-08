// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('./services/api.js', () => ({
  api: {
    me: vi.fn(),
    register: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    lookupCep: vi.fn(),
    reverseGeocode: vi.fn(),
    searchCityCenters: vi.fn(),
    smallBodyObservability: vi.fn(),
    favorites: vi.fn(),
    favorite: vi.fn(),
    saveFavorite: vi.fn(),
    refreshFavorite: vi.fn(),
    removeFavorite: vi.fn(),
  },
}));

vi.mock('./components/LocationMap.jsx', async () => {
  const { createElement } = await import('react');
  return {
    default: ({ onPointSelect, pending, cityCenters }) => createElement('div', null,
      cityCenters && createElement('p', null, `Centro geográfico ${cityCenters.geographicCenter.cep}; prefeitura ${cityCenters.civicCenter?.cep}`),
      createElement('button', {
        type: 'button',
        'aria-label': 'Selecionar ponto no mapa',
        disabled: pending,
        onClick: () => onPointSelect({ latitude: -19.4686, longitude: -42.5367 }),
      }, pending ? 'Localizando CEP…' : 'Selecionar ponto no mapa')),
  };
});

import App from './App.jsx';
import { api } from './services/api.js';

const accounts = {
  'ana@example.test': { id: 17, name: 'Ana' },
  'bruno@example.test': { id: 28, name: 'Bruno' },
};

function snapshot(cep) {
  const isIpatinga = cep.replace(/\D/g, '') === '35160000';
  return {
    location: {
      cep: cep.replace(/\D/g, ''), street: null, district: null,
      city: isIpatinga ? 'Ipatinga' : 'São Paulo', state: isIpatinga ? 'MG' : 'SP',
      ibgeCode: isIpatinga ? '3131307' : '3550308', latitude: null, longitude: null,
    },
    weather: { status: 'unavailable_no_coordinates', condition: null },
    demographics: {
      population: { status: 'unavailable' },
      density: { status: 'unavailable' },
    },
    collectedAt: '2026-10-08T12:00:00.000Z',
    status: 'partial',
    warnings: [],
  };
}

async function registerAndLogin(user, name, email, password) {
  await screen.findByRole('heading', { name: 'Bem-vindo de volta' });
  await user.click(screen.getByRole('button', { name: 'Criar conta' }));
  await user.type(screen.getByLabelText('Nome completo'), name);
  await user.type(screen.getByLabelText('E-mail'), email);
  await user.type(screen.getByLabelText('Senha'), password);
  await user.type(screen.getByLabelText('Confirmar senha'), password);
  await user.click(screen.getByRole('button', { name: 'Criar conta' }));
  await screen.findByRole('heading', { name: 'Bem-vindo de volta' });
  await loginFromForm(user, email, password);
}

async function loginFromForm(user, email, password) {
  await user.clear(screen.getByLabelText('E-mail'));
  await user.clear(screen.getByLabelText('Senha'));
  await user.type(screen.getByLabelText('E-mail'), email);
  await user.type(screen.getByLabelText('Senha'), password);
  await user.click(screen.getByRole('button', { name: 'Entrar no painel' }));
  await screen.findByLabelText('CEP brasileiro');
}

async function logout(user) {
  await user.click(screen.getByRole('button', { name: 'Sair da conta' }));
  await screen.findByRole('heading', { name: 'Bem-vindo de volta' });
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  api.me.mockResolvedValue({ data: null });
  api.register.mockResolvedValue({ data: {} });
  api.login.mockImplementation(async ({ email }) => ({ data: accounts[email] }));
  api.logout.mockResolvedValue({ data: { message: 'Sessão encerrada.' } });
  api.favorites.mockResolvedValue({ data: [] });
  api.lookupCep.mockImplementation(async (cep) => ({ data: snapshot(cep) }));
  api.searchCityCenters.mockImplementation(async ({ city, state }) => ({
    data: {
      city, state, source: 'OpenStreetMap / Nominatim', attribution: '© OpenStreetMap contributors',
      geographicCenter: { name: city, latitude: -23.55, longitude: -46.63, cep: '01001000' },
      civicCenter: { name: 'Prefeitura Municipal', latitude: -23.54, longitude: -46.62, cep: '01002000' },
    },
  }));
  api.smallBodyObservability.mockResolvedValue({ data: {
    source: 'NASA/JPL Small-Body Observability API', sourceUrl: 'https://ssd-api.jpl.nasa.gov/sbwobs.api',
    totalObjects: 4, shownObjects: 1, night: { dark_time: '08:01' },
    objects: [{
      Designation: '433', 'Full name': '433 Eros', Vmag: '10.4', 'Rise time': '22:10',
      'Transit time': '01:20', 'Set time': '04:35', 'Max. time observable': '03:12',
      'R.A.': '01:02:33', Dec: '+10 15\'00"',
    }],
  } });
});

afterEach(() => cleanup());

describe('regressão de isolamento do CEP entre sessões', () => {
  it('limpa a tela de A ao entrar B, recupera o estado próprio de A após logout e recarregamento', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App />);

    await registerAndLogin(user, 'Ana', 'ana@example.test', 'senha-ana-123');
    const cepInputA = screen.getByLabelText('CEP brasileiro');
    await user.type(cepInputA, '35160000');
    expect(cepInputA.value).toBe('35160-000');
    await user.click(screen.getByRole('button', { name: /Consultar/ }));
    await screen.findByRole('heading', { name: /Ipatinga/ });

    await logout(user);
    await loginFromForm(user, 'bruno@example.test', 'senha-bruno-123');
    const cepInputB = await screen.findByLabelText('CEP brasileiro');
    expect(cepInputB.value).toBe('');
    expect(screen.queryByRole('heading', { name: /Ipatinga/ })).toBeNull();

    await user.type(cepInputB, '01001000');
    await user.click(screen.getByRole('button', { name: /Consultar/ }));
    await screen.findByRole('heading', { name: /São Paulo/ });

    await logout(user);
    await loginFromForm(user, 'ana@example.test', 'senha-ana-123');
    expect((await screen.findByLabelText('CEP brasileiro')).value).toBe('35160-000');
    expect(await screen.findByRole('heading', { name: /Ipatinga/ })).toBeTruthy();

    const keyA = 'painel-civico:ultima-consulta:v1:17';
    const keyB = 'painel-civico:ultima-consulta:v1:28';
    expect(JSON.parse(localStorage.getItem(keyA))).toMatchObject({ cep: '35160-000', result: { location: { city: 'Ipatinga' } } });
    expect(JSON.parse(localStorage.getItem(keyB))).toMatchObject({ cep: '01001-000', result: { location: { city: 'São Paulo' } } });
    expect(Object.keys(JSON.parse(localStorage.getItem(keyA))).sort()).toEqual(['cep', 'result']);
    expect(localStorage.getItem(keyA)).not.toMatch(/senha-ana-123|password|token|session/i);
    expect(Object.keys(localStorage).sort()).toEqual([keyA, keyB]);
    expect(Object.keys(localStorage).some((key) => /password|token|session|auth/i.test(key))).toBe(false);

    unmount();
    api.me.mockResolvedValue({ data: accounts['ana@example.test'] });
    render(<App />);
    expect((await screen.findByLabelText('CEP brasileiro')).value).toBe('35160-000');
    expect(await screen.findByRole('heading', { name: /Ipatinga/ })).toBeTruthy();
    await waitFor(() => expect(api.favorites).toHaveBeenCalled());
  });

  it('descarta uma resposta atrasada de consulta quando a sessão troca de usuário', async () => {
    const user = userEvent.setup();
    render(<App />);
    await registerAndLogin(user, 'Ana', 'ana@example.test', 'senha-ana-123');

    let finishLookup;
    api.lookupCep.mockImplementationOnce(() => new Promise((resolve) => { finishLookup = resolve; }));
    await user.type(screen.getByLabelText('CEP brasileiro'), '35160000');
    await user.click(screen.getByRole('button', { name: /Consultar/ }));
    await waitFor(() => expect(api.lookupCep).toHaveBeenCalledTimes(1));

    await logout(user);
    await loginFromForm(user, 'bruno@example.test', 'senha-bruno-123');
    expect(screen.getByLabelText('CEP brasileiro').value).toBe('');

    await act(async () => {
      finishLookup({ data: snapshot('35160-000') });
    });
    expect(screen.getByLabelText('CEP brasileiro').value).toBe('');
    expect(screen.queryByRole('heading', { name: /Ipatinga/ })).toBeNull();
  });

  it('consulta pelo CEP associado ao ponto escolhido no mapa', async () => {
    const user = userEvent.setup();
    api.reverseGeocode.mockResolvedValue({ data: { cep: '35160000' } });
    render(<App />);
    await registerAndLogin(user, 'Ana', 'ana@example.test', 'senha-ana-123');

    await user.type(screen.getByLabelText('CEP brasileiro'), '01001000');
    await user.click(screen.getByRole('button', { name: /Consultar/ }));
    await screen.findByRole('heading', { name: /São Paulo/ });
    await user.click(screen.getByRole('button', { name: 'Selecionar ponto no mapa' }));

    expect(api.reverseGeocode).toHaveBeenCalledWith({ latitude: -19.4686, longitude: -42.5367 });
    expect(await screen.findByRole('heading', { name: /Ipatinga/ })).toBeTruthy();
    expect(screen.getByLabelText('CEP brasileiro').value).toBe('35160-000');
    expect(api.lookupCep).toHaveBeenLastCalledWith('35160-000');
    expect(await screen.findByText('CEP 35160-000 associado ao ponto selecionado no mapa.')).toBeTruthy();
  });

  it('busca município/UF e apresenta centro geográfico e centro cívico', async () => {
    const user = userEvent.setup();
    render(<App />);
    await registerAndLogin(user, 'Ana', 'ana@example.test', 'senha-ana-123');
    await user.click(screen.getByRole('button', { name: 'Por cidade' }));
    await user.type(screen.getByLabelText('Município'), 'São Paulo');
    await user.selectOptions(screen.getByLabelText('UF'), 'SP');
    await user.click(screen.getByRole('button', { name: 'Buscar cidade' }));

    expect(api.searchCityCenters).toHaveBeenCalledWith({ city: 'São Paulo', state: 'SP' });
    expect(await screen.findByRole('heading', { name: /São Paulo/ })).toBeTruthy();
    expect(await screen.findByText('Centro geográfico 01001000; prefeitura 01002000')).toBeTruthy();
    expect(screen.getByText(/não representa um CEP geral oficial/)).toBeTruthy();
    expect(await screen.findByRole('heading', { name: 'Pequenos corpos observáveis' })).toBeTruthy();
    expect(await screen.findByText('433 Eros')).toBeTruthy();
    await user.click(screen.getByLabelText('Somente objetos próximos da Terra (NEOs)'));
    await waitFor(() => expect(api.smallBodyObservability).toHaveBeenLastCalledWith(expect.objectContaining({
      latitude: -23.55, longitude: -46.63, nearEarthOnly: true,
    })));
  });

  it('consulta observabilidade NASA/JPL pelas coordenadas válidas do CEP', async () => {
    const user = userEvent.setup();
    const locationResult = snapshot('01001000');
    locationResult.location.latitude = -23.55;
    locationResult.location.longitude = -46.63;
    api.lookupCep.mockResolvedValueOnce({ data: locationResult });
    render(<App />);
    await registerAndLogin(user, 'Ana', 'ana@example.test', 'senha-ana-123');

    await user.type(screen.getByLabelText('CEP brasileiro'), '01001000');
    await user.click(screen.getByRole('button', { name: /Consultar/ }));

    await screen.findByRole('heading', { name: /São Paulo/ });
    await waitFor(() => expect(api.smallBodyObservability).toHaveBeenCalledWith(expect.objectContaining({
      latitude: -23.55, longitude: -46.63, nearEarthOnly: false,
    })));
  });
});
