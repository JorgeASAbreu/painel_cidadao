const STORAGE_KEY_PREFIX = 'painel-civico:ultima-consulta:v1:';

function getStorage(storage) {
  if (storage) return storage;
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
}

export function userConsultationStorageKey(userId) {
  if (userId === null || userId === undefined || String(userId).trim() === '') return null;
  return `${STORAGE_KEY_PREFIX}${String(userId)}`;
}

export function readUserConsultation(userId, storage) {
  const key = userConsultationStorageKey(userId);
  const target = getStorage(storage);
  if (!key || !target) return null;

  try {
    const value = target.getItem(key);
    if (!value) return null;
    const saved = JSON.parse(value);
    if (!saved || typeof saved !== 'object' || typeof saved.cep !== 'string') return null;
    return {
      cep: saved.cep,
      result: saved.result && typeof saved.result === 'object' ? saved.result : null,
    };
  } catch {
    return null;
  }
}

export function saveUserConsultation(userId, { cep, result }, storage) {
  const key = userConsultationStorageKey(userId);
  const target = getStorage(storage);
  if (!key || !target) return false;

  try {
    // Authentication data is deliberately excluded: only the user's latest
    // CEP input and its displayed result are kept in this browser.
    target.setItem(key, JSON.stringify({ cep: String(cep || ''), result: result || null }));
    return true;
  } catch {
    return false;
  }
}
