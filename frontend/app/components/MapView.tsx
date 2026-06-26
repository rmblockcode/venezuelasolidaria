"use client";

import { useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { Resource } from "../lib/types";
import { CATS } from "../lib/constants";
import { formatEventRange } from "../lib/format";

// Teardrop pin colored by category — avoids Leaflet's default-icon bundling issue.
function pinIcon(color: string) {
  const html = `<svg width="28" height="38" viewBox="0 0 28 38" xmlns="http://www.w3.org/2000/svg">
    <path d="M14 0C6.8 0 1 5.8 1 13c0 9.2 13 25 13 25s13-15.8 13-25C27 5.8 21.2 0 14 0z"
      fill="${color}" stroke="#fff" stroke-width="2"/>
    <circle cx="14" cy="13" r="4.5" fill="#fff"/>
  </svg>`;
  return L.divIcon({
    html,
    className: "vz-pin",
    iconSize: [28, 38],
    iconAnchor: [14, 38],
    popupAnchor: [0, -34],
  });
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useMemo(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 11);
    } else {
      map.fitBounds(L.latLngBounds(points), { padding: [48, 48] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points.length, map]);
  return null;
}

export default function MapView({ items }: { items: Resource[] }) {
  const located = items.filter(
    (i): i is Resource & { lat: number; lng: number } =>
      typeof i.lat === "number" && typeof i.lng === "number"
  );
  const points = located.map((i) => [i.lat, i.lng] as [number, number]);

  return (
    <div className="mapwrap">
      <MapContainer
        center={[8, -66]}
        zoom={5}
        scrollWheelZoom
        className="leaflet-map"
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={points} />
        <MarkerClusterGroup chunkedLoading>
          {located.map((item) => {
            const c = CATS[item.category];
            const meta = [item.city, item.country, formatEventRange(item.date, item.dateEnd)]
              .filter(Boolean)
              .join(" · ");
            const isPhone = !item.url && !!item.phone;
            const href = isPhone ? `tel:${item.phone}` : item.url || "#";
            const actionLabel = isPhone ? "Llamar" : c.action;
            return (
              <Marker key={item.id} position={[item.lat, item.lng]} icon={pinIcon(c.color)}>
                <Popup>
                  <div className="map-pop" style={{ ["--cat" as string]: c.color }}>
                    {item.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.image} alt="" className="map-pop-img" />
                    )}
                    <span className="map-pop-tag">{c.label}</span>
                    <h4>{item.title}</h4>
                    {meta && <p className="map-pop-meta">{meta}</p>}
                    {(item.url || item.phone) && (
                      <a
                        href={href}
                        target={isPhone ? undefined : "_blank"}
                        rel="noopener noreferrer"
                        className="map-pop-btn"
                      >
                        {actionLabel}
                      </a>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MarkerClusterGroup>
      </MapContainer>
    </div>
  );
}
