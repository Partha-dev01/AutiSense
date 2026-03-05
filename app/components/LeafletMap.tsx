"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default marker icons (Leaflet + bundler issue)
const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = defaultIcon;

const liveIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
  className: "leaflet-marker-live",
});

export interface MapMarker {
  id: string | number;
  lat: number;
  lng: number;
  name: string;
  type: string;
  phone?: string;
  website?: string;
  isLive?: boolean;
}

interface Props {
  center: [number, number];
  zoom?: number;
  markers: MapMarker[];
  height?: number | string;
}

function RecenterMap({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

export default function LeafletMap({ center, zoom = 12, markers, height = 400 }: Props) {
  return (
    <MapContainer
      center={center}
      zoom={zoom}
      style={{ height, width: "100%", borderRadius: "var(--r-lg, 16px)", zIndex: 1 }}
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <RecenterMap center={center} />
      {markers.map((m) => (
        <Marker
          key={m.id}
          position={[m.lat, m.lng]}
          icon={m.isLive ? liveIcon : defaultIcon}
        >
          <Popup>
            <div style={{ fontFamily: "'Nunito', sans-serif", minWidth: 160 }}>
              <strong>{m.name}</strong>
              <br />
              <span style={{ fontSize: "0.8rem", color: "#666" }}>{m.type}</span>
              {m.isLive && (
                <span style={{
                  display: "inline-block", marginLeft: 6, fontSize: "0.65rem",
                  background: "#4d8058", color: "white", padding: "1px 6px",
                  borderRadius: 9999, fontWeight: 700,
                }}>
                  Live
                </span>
              )}
              {m.phone && <><br /><a href={`tel:${m.phone}`}>{m.phone}</a></>}
              {m.website && <><br /><a href={m.website} target="_blank" rel="noopener noreferrer">Website</a></>}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
