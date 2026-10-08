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
    favorites: vi.fn(),
    favorite: vi.fn(),
    saveFavorite: vi.fn(),
    refreshFavorite: vi.fn(),
    removeFavorite: vi.fn(),
  },
}));

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
});
