import { describe, expect, it } from 'vitest';
import { readUserConsultation, saveUserConsultation, userConsultationStorageKey } from './userConsultationStore.js';

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    keys: () => [...values.keys()],
  };
}

describe('armazenamento local da última consulta por usuário', () => {
  it('isola CEP e resultado por ID e mantém somente os campos da consulta', () => {
    const storage = createMemoryStorage();
    const resultA = { location: { cep: '35160000', city: 'Ipatinga' } };
    const resultB = { location: { cep: '01001000', city: 'São Paulo' } };

    expect(saveUserConsultation(17, { cep: '35160-000', result: resultA }, storage)).toBe(true);
    expect(saveUserConsultation(28, { cep: '01001-000', result: resultB }, storage)).toBe(true);

    expect(readUserConsultation(17, storage)).toEqual({ cep: '35160-000', result: resultA });
    expect(readUserConsultation(28, storage)).toEqual({ cep: '01001-000', result: resultB });
    expect(readUserConsultation(99, storage)).toBeNull();
    expect(JSON.parse(storage.getItem(userConsultationStorageKey(17)))).toEqual({ cep: '35160-000', result: resultA });
    expect(storage.keys()).toEqual([
      'painel-civico:ultima-consulta:v1:17',
      'painel-civico:ultima-consulta:v1:28',
    ]);
  });

  it('ignora ID ausente, conteúdo inválido e não falha se o navegador bloquear o armazenamento', () => {
    const storage = createMemoryStorage();
    storage.setItem(userConsultationStorageKey(17), '{invalid json');

    expect(userConsultationStorageKey(null)).toBeNull();
    expect(readUserConsultation(17, storage)).toBeNull();
    expect(saveUserConsultation(null, { cep: '35160-000', result: null }, storage)).toBe(false);
    expect(saveUserConsultation(17, { cep: '35160-000', result: null }, {
      setItem() { throw new Error('storage bloqueado'); },
    })).toBe(false);
  });
});
