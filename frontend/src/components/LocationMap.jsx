import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIconRetina from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { MapPin } from 'lucide-react';

const addressMarker = new L.Icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIconRetina,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const geographicMarker = L.divIcon({
  className: 'city-map-marker geographic-center-marker',
  html: '<span>G</span>',
  iconSize: [34, 34],
  iconAnchor: [17, 17],
  popupAnchor: [0, -17],
});

const civicMarker = L.divIcon({
  className: 'city-map-marker civic-center-marker',
  html: '<span>P</span>',
  iconSize: [34, 34],
  iconAnchor: [17, 17],
  popupAnchor: [0, -17],
});

function validCoordinates(latitude, longitude) {
  return typeof latitude === 'number' && typeof longitude === 'number'
    && Number.isFinite(latitude) && Number.isFinite(longitude)
    && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
}

function MapPointSelector({ disabled, onSelect }) {
  useMapEvents({
    click: (event) => {
      if (!disabled && onSelect) onSelect({ latitude: event.latlng.lat, longitude: event.latlng.lng });
    },
  });
  return null;
}

function FitMapToPoints({ points, center, zoom }) {
  const map = useMap();
  const pointsKey = points.map((point) => point ? `${point.latitude},${point.longitude}` : '').join('|');
  useEffect(() => {
    const validPoints = points.filter((point) => point && validCoordinates(point.latitude, point.longitude));
    if (validPoints.length > 1) {
      map.fitBounds(validPoints.map((point) => [point.latitude, point.longitude]), { padding: [36, 36], maxZoom: 14 });
    } else {
      map.setView([center.latitude, center.longitude], zoom);
    }
  }, [map, pointsKey, center.latitude, center.longitude, zoom]);
  return null;
}

export default function LocationMap({ location, onPointSelect, pending = false, cityCenters = null }) {
  const [tileError, setTileError] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const wasPending = useRef(pending);
  const geographicCenter = cityCenters?.geographicCenter;
  const civicCenter = cityCenters?.civicCenter;
  const mapLocation = geographicCenter || location;
  const hasCoordinates = validCoordinates(mapLocation?.latitude, mapLocation?.longitude);
  const mapZoom = cityCenters ? 12 : 16;

  useEffect(() => {
    if (wasPending.current && !pending) setSelectedPoint(null);
    wasPending.current = pending;
  }, [pending]);

  return (
    <section className="info-card location-map-card" aria-labelledby="location-map-title">
      <div className="card-heading">
        <span className="icon-bubble address-icon"><MapPin size={20} /></span>
        <div><p className="eyebrow">{cityCenters ? 'REFERÊNCIAS DA CIDADE' : 'MAPA DO CEP'}</p><h3 id="location-map-title">{cityCenters ? 'Centro geográfico × centro cívico' : 'Localização associada ao endereço'}</h3></div>
      </div>
      {hasCoordinates ? (
        <>
          <div className="location-map-frame" role="region" aria-label={cityCenters ? `Mapa dos centros de ${cityCenters.city} — ${cityCenters.state}` : `Mapa da localização associada ao CEP ${location?.cep || ''}`}>
            <MapContainer
              key={`${mapLocation.latitude},${mapLocation.longitude},${cityCenters ? 'city' : 'cep'}`}
              center={[mapLocation.latitude, mapLocation.longitude]}
              zoom={mapZoom}
              scrollWheelZoom={false}
              className="location-map"
            >
              <TileLayer
                url="/api/map/tiles/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
                maxZoom={19}
                eventHandlers={{
                  tileerror: () => setTileError(true),
                  tileload: () => setTileError(false),
                }}
              />
              {cityCenters && <FitMapToPoints points={[geographicCenter, civicCenter]} center={geographicCenter} zoom={mapZoom} />}
              <MapPointSelector
                disabled={pending}
                onSelect={onPointSelect ? (point) => {
                  setSelectedPoint(point);
                  onPointSelect(point);
                } : null}
              />
              {cityCenters ? (
                <>
                  <Marker position={[geographicCenter.latitude, geographicCenter.longitude]} icon={geographicMarker}>
                    <Popup><strong>Centro geográfico</strong><br />{cityCenters.city} — {cityCenters.state}<br />CEP associado: {formatCep(geographicCenter.cep)}</Popup>
                  </Marker>
                  {civicCenter && <Marker position={[civicCenter.latitude, civicCenter.longitude]} icon={civicMarker}>
                    <Popup><strong>Centro cívico · prefeitura</strong><br />{civicCenter.name}<br />CEP associado: {formatCep(civicCenter.cep)}</Popup>
                  </Marker>}
                </>
              ) : (
                <Marker position={[location.latitude, location.longitude]} icon={addressMarker}>
                  <Popup><strong>{location.street || 'Logradouro não informado'}</strong><br />{location.cep || 'CEP não informado'} · {location.city} — {location.state}</Popup>
                </Marker>
              )}
              {selectedPoint && <Marker position={[selectedPoint.latitude, selectedPoint.longitude]} icon={addressMarker}><Popup>Buscando o CEP associado a este ponto…</Popup></Marker>}
            </MapContainer>
            {tileError && <div className="map-status" role="status">Não foi possível carregar o mapa. Verifique sua conexão.</div>}
            {pending && <div className="map-selection-status" role="status"><span className="spinner" />Buscando o CEP associado ao ponto…</div>}
          </div>
          {cityCenters ? (
            <>
              <div className="city-center-legend">
                <div className="city-center-item"><span className="city-center-symbol geographic-symbol">G</span><div><strong>Centro geográfico</strong><span>CEP associado: {formatCep(geographicCenter.cep)}</span></div></div>
                {civicCenter ? <div className="city-center-item"><span className="city-center-symbol civic-symbol">P</span><div><strong>Prefeitura · centro cívico</strong><span>{civicCenter.name} · CEP associado: {formatCep(civicCenter.cep)}</span></div></div> : <p className="map-caption">Prefeitura não localizada nos dados mapeados para este município.</p>}
              </div>
              <p className="map-caption">Pontos e CEPs associados vêm do OpenStreetMap/Nominatim; o centro geográfico é a coordenada publicada para o município, não um ponto oficial dos Correios. A prefeitura representa o centro cívico quando identificada no mapa.</p>
            </>
          ) : <p className="map-caption">Ponto aproximado associado ao CEP atual. Clique no mapa para consultar o CEP associado ao ponto escolhido. O resultado depende dos dados mapeados no OpenStreetMap e não garante o CEP oficial mais próximo.</p>}
        </>
      ) : (
        <div className="map-unavailable" role="status">
          <MapPin size={20} />
          <p>Mapa indisponível: a BrasilAPI não forneceu coordenadas válidas para este CEP.</p>
        </div>
      )}
    </section>
  );
}

function formatCep(value) {
  if (!value) return 'não disponível';
  const digits = String(value).replace(/\D/g, '');
  return digits.length === 8 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : 'não disponível';
}
