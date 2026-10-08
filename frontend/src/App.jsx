import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownRight, ArrowUpRight, Bookmark, Check, ChevronRight, CloudSun, Compass,
  Home, LogOut, MapPin, RefreshCw, Search, Star, Trash2, UsersRound, X,
} from 'lucide-react';
import Brand from './components/Brand.jsx';
import DemographicCard from './components/DemographicCard.jsx';
import WeatherCard, { formatDateTime } from './components/WeatherCard.jsx';
import { api } from './services/api.js';
import { readUserConsultation, saveUserConsultation } from './services/userConsultationStore.js';
import coastImage from '../../example/fundo-612x612.jpg';

export default function App() {
  const [user, setUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [authMode, setAuthMode] = useState('login');
  const [activePage, setActivePage] = useState('dashboard');
  const [cep, setCep] = useState('');
  const [result, setResult] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const [selectedFavorite, setSelectedFavorite] = useState(null);
  const [loading, setLoading] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [favoriteSearch, setFavoriteSearch] = useState('');
  const activeUserIdRef = useRef(null);

  const loadFavorites = useCallback(async () => {
    const requestedUserId = activeUserIdRef.current;
    if (requestedUserId === null) return [];
    const response = await api.favorites();
    if (activeUserIdRef.current === requestedUserId) setFavorites(response.data);
    return response.data;
  }, []);

  useEffect(() => {
    api.me().then(async ({ data }) => {
      if (data) {
        activeUserIdRef.current = data.id;
        const saved = readUserConsultation(data.id);
        setCep(saved?.cep || '');
        setResult(saved?.result || null);
        setUser(data);
        await loadFavorites();
      }
    }).catch(() => {}).finally(() => setCheckingSession(false));
  }, [loadFavorites]);

  const currentFavorite = useMemo(() => {
    if (!result?.location?.ibgeCode) return null;
    return favorites.find((item) => item.ibgeCode === result.location.ibgeCode) || null;
  }, [favorites, result]);

  const filteredFavorites = useMemo(() => {
    const term = favoriteSearch.trim().toLocaleLowerCase('pt-BR');
    if (!term) return favorites;
    return favorites.filter((item) => `${item.cityName} ${item.stateCode} ${item.ibgeCode}`.toLocaleLowerCase('pt-BR').includes(term));
  }, [favorites, favoriteSearch]);

  async function handleAuth(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    const formData = new FormData(event.currentTarget);
    const values = Object.fromEntries(formData.entries());
    if (authMode === 'register' && values.password !== values.confirmPassword) {
      setError('As senhas informadas não coincidem.');
      return;
    }
    setLoading('auth');
    try {
      if (authMode === 'register') {
        await api.register(values);
        setAuthMode('login');
        setNotice('Conta criada. Agora entre com seu e-mail e senha.');
      } else {
        const response = await api.login(values);
        const saved = readUserConsultation(response.data.id);
        activeUserIdRef.current = response.data.id;
        setCep(saved?.cep || '');
        setResult(saved?.result || null);
        setFavorites([]);
        setSelectedFavorite(null);
        setFavoriteSearch('');
        setUser(response.data);
        setActivePage('dashboard');
        setNotice('Que bom ter você por aqui.');
        await loadFavorites();
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading('');
    }
  }

  async function handleLookup(event) {
    event.preventDefault();
    const requestedUserId = activeUserIdRef.current;
    const requestedCep = cep;
    if (requestedUserId === null) return;
    setError('');
    setNotice('');
    setResult(null);
    saveUserConsultation(requestedUserId, { cep: requestedCep, result: null });
    setLoading('lookup');
    try {
      const response = await api.lookupCep(requestedCep);
      if (activeUserIdRef.current !== requestedUserId) return;
      setResult(response.data);
      saveUserConsultation(requestedUserId, { cep: requestedCep, result: response.data });
      await loadFavorites();
    } catch (requestError) {
      if (activeUserIdRef.current === requestedUserId) setError(requestError.message);
    } finally {
      if (activeUserIdRef.current === requestedUserId) setLoading('');
    }
  }

  function handleCepChange(value) {
    setCep(value);
    if (activeUserIdRef.current !== null) {
      saveUserConsultation(activeUserIdRef.current, { cep: value, result });
    }
  }

  async function handleFavorite() {
    if (!result) return;
    const requestedUserId = activeUserIdRef.current;
    if (requestedUserId === null) return;
    setError('');
    setLoading('favorite');
    try {
      if (currentFavorite) {
        if (!window.confirm(`Remover ${currentFavorite.cityName} dos favoritos?`)) return;
        await api.removeFavorite(currentFavorite.id);
        if (activeUserIdRef.current !== requestedUserId) return;
        setNotice(`${currentFavorite.cityName} removido dos favoritos.`);
      } else {
        await api.saveFavorite(result);
        if (activeUserIdRef.current !== requestedUserId) return;
        setNotice(`${result.location.city} adicionado aos favoritos.`);
      }
      await loadFavorites();
    } catch (requestError) {
      if (activeUserIdRef.current === requestedUserId) setError(requestError.message);
    } finally {
      if (activeUserIdRef.current === requestedUserId) setLoading('');
    }
  }

  async function openFavorite(id) {
    const requestedUserId = activeUserIdRef.current;
    setError('');
    setNotice('');
    setLoading('detail');
    try {
      const response = await api.favorite(id);
      if (activeUserIdRef.current !== requestedUserId) return;
      setSelectedFavorite(response.data);
      setActivePage('detail');
    } catch (requestError) {
      if (activeUserIdRef.current === requestedUserId) setError(requestError.message);
    } finally {
      if (activeUserIdRef.current === requestedUserId) setLoading('');
    }
  }

  async function handleRefresh(id) {
    const requestedUserId = activeUserIdRef.current;
    if (requestedUserId === null) return;
    setError('');
    setLoading(`refresh-${id}`);
    try {
      const response = await api.refreshFavorite(id);
      if (activeUserIdRef.current !== requestedUserId) return;
      setSelectedFavorite(response.data);
      await loadFavorites();
      setNotice('Snapshot atualizado com os dados disponíveis agora.');
    } catch (requestError) {
      if (activeUserIdRef.current === requestedUserId) setError(requestError.message);
    } finally {
      if (activeUserIdRef.current === requestedUserId) setLoading('');
    }
  }

  async function handleRemoveFavorite(item) {
    if (!window.confirm(`Remover ${item.cityName} dos favoritos?`)) return;
    const requestedUserId = activeUserIdRef.current;
    if (requestedUserId === null) return;
    setError('');
    setLoading(`remove-${item.id}`);
    try {
      await api.removeFavorite(item.id);
      if (activeUserIdRef.current !== requestedUserId) return;
      setFavorites((current) => current.filter((favorite) => favorite.id !== item.id));
      setSelectedFavorite(null);
      setActivePage('favorites');
      setNotice(`${item.cityName} removido dos favoritos.`);
    } catch (requestError) {
      if (activeUserIdRef.current === requestedUserId) setError(requestError.message);
    } finally {
      if (activeUserIdRef.current === requestedUserId) setLoading('');
    }
  }

  async function handleLogout() {
    activeUserIdRef.current = null;
    setUser(null);
    setCep('');
    setResult(null);
    setFavorites([]);
    setSelectedFavorite(null);
    setFavoriteSearch('');
    setActivePage('dashboard');
    setError('');
    setNotice('');
    setLoading('logout');
    try {
      await api.logout();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading('');
    }
  }

  if (checkingSession) return <div className="app-loading"><span className="spinner" />Conectando ao Painel Cívico…</div>;
  if (!user) {
    return <AuthScreen mode={authMode} setMode={setAuthMode} onSubmit={handleAuth} loading={loading === 'auth'} error={error} notice={notice} />;
  }

  const shownSnapshot = activePage === 'detail' ? selectedFavorite?.snapshot : null;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <div className="sidebar-label">MENU PRINCIPAL</div>
        <nav className="side-nav" aria-label="Navegação principal">
          <button className={activePage === 'dashboard' ? 'nav-item active' : 'nav-item'} onClick={() => { setActivePage('dashboard'); setError(''); }}>
            <Home size={18} /><span>Painel</span>
          </button>
          <button className={activePage === 'favorites' || activePage === 'detail' ? 'nav-item active' : 'nav-item'} onClick={() => { setActivePage('favorites'); setError(''); loadFavorites().catch(() => {}); }}>
            <Bookmark size={18} /><span>Favoritos</span><span className="nav-count">{favorites.length}</span>
          </button>
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-tip"><span className="tip-icon"><Compass size={18} /></span><strong>Informação perto de você</strong><p>Consulte dados oficiais do seu município em um só lugar.</p></div>
        <div className="sidebar-profile">
          <span className="avatar">{user.name?.slice(0, 1).toUpperCase()}</span>
          <span className="profile-copy"><strong>{user.name}</strong><small>Conta local</small></span>
          <button className="icon-button logout-button" aria-label="Sair da conta" title="Sair" onClick={handleLogout} disabled={loading === 'logout'}><LogOut size={17} /></button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="mobile-brand"><Brand compact /></div>
          <div className="breadcrumbs"><span>Início</span><ChevronRight size={14} /><strong>{activePage === 'favorites' ? 'Favoritos' : activePage === 'detail' ? 'Detalhe do município' : 'Painel'}</strong></div>
          <div className="topbar-right"><span className="local-indicator"><i /> Ambiente local</span><span className="top-avatar">{user.name?.slice(0, 1).toUpperCase()}</span></div>
        </header>

        <div className="content-area">
          {error && <div className="alert alert-error" role="alert"><span>{error}</span><button aria-label="Fechar mensagem" onClick={() => setError('')}><X size={16} /></button></div>}
          {notice && <div className="alert alert-success" role="status"><Check size={17} /><span>{notice}</span><button aria-label="Fechar mensagem" onClick={() => setNotice('')}><X size={16} /></button></div>}

          {activePage === 'dashboard' && (
            <Dashboard
              cep={cep} onCepChange={handleCepChange} loading={loading} result={result} favorite={currentFavorite}
              onLookup={handleLookup} onFavorite={handleFavorite}
            />
          )}
          {activePage === 'favorites' && (
            <FavoritesPage favorites={filteredFavorites} search={favoriteSearch} setSearch={setFavoriteSearch} loading={loading} onOpen={openFavorite} />
          )}
          {activePage === 'detail' && shownSnapshot && (
            <FavoriteDetail
              favorite={selectedFavorite} snapshot={shownSnapshot} loading={loading}
              onBack={() => setActivePage('favorites')}
              onRefresh={() => handleRefresh(selectedFavorite.id)}
              onRemove={() => handleRemoveFavorite(selectedFavorite)}
            />
          )}
          {activePage === 'detail' && !shownSnapshot && loading !== 'detail' && <EmptyState title="Favorito não encontrado" detail="Volte à lista e selecione outro município." />}
        </div>
        <footer className="page-footer"><span>Painel Cívico Municipal</span><span>Dados oficiais · consulta local</span></footer>
      </main>
    </div>
  );
}

function AuthScreen({ mode, setMode, onSubmit, loading, error, notice }) {
  const registering = mode === 'register';
  return (
    <main className="auth-page" style={{ '--coast-image': `url("${coastImage}")` }}>
      <section className="auth-visual">
        <div className="auth-visual-shade" />
        <div className="auth-visual-content"><Brand /><span className="auth-kicker">CIDADANIA INFORMADA</span><h1>Conheça melhor<br />o lugar onde você vive.</h1><p>Endereço, clima e indicadores oficiais reunidos em um painel simples e acessível.</p><div className="auth-visual-foot"><span><MapPin size={15} /> Brasil, município por município</span><span>01 / 03</span></div></div>
      </section>
      <section className="auth-form-side">
        <div className="auth-mobile-brand"><Brand /></div>
        <form className="auth-card" onSubmit={onSubmit}>
          <span className="auth-step">PAINEL CÍVICO MUNICIPAL</span>
          <h2>{registering ? 'Crie sua conta' : 'Bem-vindo de volta'}</h2>
          <p className="auth-subtitle">{registering ? 'Comece a acompanhar informações do seu município.' : 'Entre para consultar e salvar seus municípios favoritos.'}</p>
          {error && <div className="form-message form-error" role="alert">{error}</div>}
          {notice && <div className="form-message form-success" role="status">{notice}</div>}
          {registering && <label className="field-label">Nome completo<input name="name" type="text" autoComplete="name" placeholder="Como podemos chamar você?" required maxLength="100" /></label>}
          <label className="field-label">E-mail<input name="email" type="email" autoComplete="email" placeholder="voce@email.com" required /></label>
          <label className="field-label">Senha<input name="password" type="password" autoComplete={registering ? 'new-password' : 'current-password'} placeholder={registering ? 'Mínimo de 8 caracteres' : 'Digite sua senha'} minLength="8" required /></label>
          {registering && <label className="field-label">Confirmar senha<input name="confirmPassword" type="password" autoComplete="new-password" placeholder="Repita sua senha" minLength="8" required /></label>}
          <button className="primary-button auth-submit" type="submit" disabled={loading}>{loading ? <><span className="spinner spinner-light" />Aguarde…</> : registering ? 'Criar conta' : 'Entrar no painel'}<ChevronRight size={18} /></button>
          <p className="auth-switch">{registering ? 'Já tem uma conta?' : 'Ainda não tem uma conta?'} <button type="button" onClick={() => setMode(registering ? 'login' : 'register')}>{registering ? 'Fazer login' : 'Criar conta'}</button></p>
          <p className="local-note"><span /> Seus dados ficam neste computador.</p>
        </form>
      </section>
    </main>
  );
}

function Dashboard({ cep, onCepChange, loading, result, favorite, onLookup, onFavorite }) {
  return (
    <>
      <section className="welcome-row"><div><span className="section-kicker">PAINEL MUNICIPAL</span><h1>Olá, que bom ter você aqui.</h1><p>Encontre informações úteis sobre qualquer município brasileiro.</p></div><div className="today-chip"><span className="today-dot" />Atualizado conforme as fontes oficiais</div></section>
      <section className="search-hero" style={{ '--coast-image': `url("${coastImage}")` }}>
        <div className="hero-content"><span className="hero-label"><MapPin size={15} /> BUSCA POR CEP</span><h2>Seu município, em perspectiva.</h2><p>Digite um CEP para consultar endereço, clima e indicadores oficiais.</p>
          <form className="cep-form" onSubmit={onLookup}><label className="sr-only" htmlFor="cep-input">CEP brasileiro</label><div className="cep-input-wrap"><Search size={19} /><input id="cep-input" inputMode="numeric" autoComplete="postal-code" placeholder="Digite o CEP, ex.: 01001-000" value={cep} onChange={(event) => onCepChange(formatCepInput(event.target.value))} maxLength="9" /></div><button className="primary-button search-button" type="submit" disabled={loading === 'lookup'}>{loading === 'lookup' ? <><span className="spinner spinner-light" />Buscando</> : <>Consultar <ArrowUpRight size={17} /></>}</button></form>
        </div>
        <div className="hero-coordinate"><span>INFORMAÇÃO LOCAL</span><strong>Brasil <ArrowDownRight size={15} /></strong></div>
      </section>

      {result ? <LocationResults result={result} favorite={favorite} loading={loading} onFavorite={onFavorite} /> : <DashboardWelcome />}
    </>
  );
}

function DashboardWelcome() {
  return (
    <section className="welcome-grid">
      <article className="welcome-card"><span className="welcome-icon"><CloudSun size={21} /></span><div><strong>Clima e bem-estar</strong><p>Veja as condições meteorológicas quando houver coordenadas disponíveis.</p></div></article>
      <article className="welcome-card"><span className="welcome-icon icon-green"><UsersRound size={21} /></span><div><strong>Indicadores oficiais</strong><p>Consulte população e densidade demográfica com fonte e ano.</p></div></article>
      <article className="welcome-card"><span className="welcome-icon icon-gold"><Star size={21} /></span><div><strong>Seus lugares favoritos</strong><p>Salve snapshots para consultar novamente, mesmo sem internet.</p></div></article>
      <div className="empty-hint"><span className="hint-line" /><span>Comece digitando um CEP acima</span><span className="hint-line" /></div>
    </section>
  );
}

function LocationResults({ result, favorite, loading, onFavorite }) {
  const { location, weather, demographics, warnings } = result;
  return (
    <section className="results-section" aria-live="polite">
      <div className="results-heading"><div><span className="section-kicker">RESULTADO DA CONSULTA</span><h2>{location.city} <span className="state-pill">{location.state}</span></h2><p>{location.region?.nome ? `${location.region.nome} · ` : ''}Código IBGE {location.ibgeCode || 'não confirmado'}</p></div>
        {location.ibgeCode && <button className={favorite ? 'outline-button is-saved' : 'primary-button'} onClick={onFavorite} disabled={loading === 'favorite'}>{loading === 'favorite' ? <span className="spinner" /> : favorite ? <><Check size={17} /> Favorito salvo</> : <><Star size={17} /> Favoritar município</>}</button>}
      </div>
      {warnings?.length > 0 && <div className="partial-notice"><Compass size={17} /><div><strong>Consulta com informações parciais</strong><ul>{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div></div>}
      <div className="result-grid">
        <AddressCard location={location} />
        <WeatherCard weather={weather} />
        <DemographicCard demographics={demographics} />
      </div>
      <div className="collected-note"><span className="today-dot" />Consulta realizada em {formatDateTime(result.collectedAt)} · Pesquisas comuns não são salvas.</div>
    </section>
  );
}

function AddressCard({ location }) {
  return (
    <section className="info-card address-card">
      <div className="card-heading"><span className="icon-bubble address-icon"><MapPin size={20} /></span><div><p className="eyebrow">LOCALIZAÇÃO</p><h3>Endereço de referência</h3></div></div>
      <div className="address-lines"><strong>{location.street || 'Logradouro não informado'}</strong><span>{location.district || 'Bairro não informado'}</span><span>{location.city} — {location.state}</span></div>
      <div className="address-meta"><div><span>CEP</span><strong>{formatCep(location.cep)}</strong></div><div><span>Código IBGE</span><strong>{location.ibgeCode || 'Não localizado'}</strong></div></div>
      {location.latitude !== null && location.longitude !== null && <div className="coordinates"><Compass size={14} /><span>{location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}</span></div>}
    </section>
  );
}

function FavoritesPage({ favorites, search, setSearch, loading, onOpen }) {
  return (
    <section className="page-section">
      <div className="page-title-row"><div><span className="section-kicker">SUA LISTA PESSOAL</span><h1>Municípios favoritos</h1><p>Snapshots guardados neste computador para consultar quando precisar.</p></div><span className="count-badge"><Star size={16} /> {favorites.length}</span></div>
      <div className="favorite-toolbar"><label className="favorite-search"><Search size={17} /><input aria-label="Buscar favorito" placeholder="Buscar município ou UF" value={search} onChange={(event) => setSearch(event.target.value)} /><kbd>⌘ K</kbd></label><span className="offline-caption"><span className="offline-dot" />Disponíveis sem internet</span></div>
      {loading === 'detail' && <div className="inline-loading"><span className="spinner" />Abrindo snapshot salvo…</div>}
      {favorites.length ? <div className="favorites-grid">{favorites.map((favorite) => <FavoriteCard key={favorite.id} favorite={favorite} onOpen={onOpen} />)}</div> : <EmptyState title={search ? 'Nenhum município encontrado' : 'Sua lista começa aqui'} detail={search ? 'Tente buscar por outro nome ou sigla.' : 'Pesquise um CEP e favorite um município para guardar seus dados.'} />}
    </section>
  );
}

function FavoriteCard({ favorite, onOpen }) {
  const weather = favorite.snapshot?.weather;
  return (
    <button className="favorite-card" onClick={() => onOpen(favorite.id)}>
      <span className="favorite-card-icon"><MapPin size={19} /></span><span className="favorite-card-main"><strong>{favorite.cityName}</strong><small>{favorite.stateCode} · IBGE {favorite.ibgeCode}</small></span><ChevronRight className="favorite-chevron" size={18} />
      <span className="favorite-card-metrics"><span><CloudSun size={15} />{weather?.status === 'available' ? `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(weather.temperatureC)}°` : 'Clima —'}</span><span><Bookmark size={14} />Salvo em {formatDateTime(favorite.snapshotAt)}</span></span>
    </button>
  );
}

function FavoriteDetail({ favorite, snapshot, loading, onBack, onRefresh, onRemove }) {
  const location = snapshot.location;
  return (
    <section className="page-section">
      <button className="back-link" onClick={onBack}><ChevronRight className="back-chevron" size={16} />Voltar aos favoritos</button>
      <div className="page-title-row detail-title"><div><span className="section-kicker">SNAPSHOT MUNICIPAL</span><h1>{location.city} <span className="state-pill">{location.state}</span></h1><p>Código IBGE {location.ibgeCode} · CEP de referência {formatCep(location.cep)}</p></div><div className="detail-actions"><button className="outline-button" onClick={onRefresh} disabled={loading === `refresh-${favorite.id}`}><RefreshCw size={16} className={loading === `refresh-${favorite.id}` ? 'spin' : ''} />Atualizar</button><button className="danger-button" onClick={onRemove} disabled={loading === `remove-${favorite.id}`}><Trash2 size={16} />Remover</button></div></div>
      <div className="saved-banner"><Bookmark size={17} /><span>Dados salvos em <strong>{formatDateTime(favorite.snapshotAt)}</strong>. Estes são os últimos dados registrados e podem estar desatualizados.</span></div>
      <div className="result-grid detail-grid"><AddressCard location={location} /><WeatherCard weather={snapshot.weather} historical /><DemographicCard demographics={snapshot.demographics} /></div>
      {snapshot.warnings?.length > 0 && <div className="partial-notice detail-warnings"><Compass size={17} /><div><strong>Informações indisponíveis no momento da coleta</strong><ul>{snapshot.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div></div>}
      <p className="snapshot-footnote">A abertura deste favorito não consulta serviços externos. Use “Atualizar” para obter novos dados quando houver conexão.</p>
    </section>
  );
}

function EmptyState({ title, detail }) {
  return <div className="empty-state"><span className="empty-state-icon"><Bookmark size={22} /></span><h3>{title}</h3><p>{detail}</p></div>;
}

function formatCep(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 8);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

function formatCepInput(value) {
  return formatCep(value);
}
