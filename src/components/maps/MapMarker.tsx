'use client';

import { useEffect, useRef } from 'react';

export interface MapMarkerProps {
  map: google.maps.Map | null;
  position: { lat: number; lng: number };
  title?: string;
  icon?: string | google.maps.Icon | google.maps.Symbol;
  onClick?: () => void;
  zIndex?: number;
}

/**
 * MapMarker
 * 
 * Reusable map marker with lifecycle management and listener cleanup.
 */
export function MapMarker({
  map,
  position,
  title,
  icon,
  onClick,
  zIndex,
}: MapMarkerProps) {
  const markerRef = useRef<google.maps.Marker | null>(null);
  const clickListenerRef = useRef<google.maps.MapsEventListener | null>(null);
  const onClickRef = useRef(onClick);

  useEffect(() => {
    onClickRef.current = onClick;
  }, [onClick]);

  const posLat = position.lat;
  const posLng = position.lng;

  // Initialize marker on mount / when map becomes available
  useEffect(() => {
    if (!map) return;

    if (!markerRef.current) {
      const marker = new google.maps.Marker({
        position: { lat: posLat, lng: posLng },
        map,
        title,
        icon,
        zIndex,
      });
      markerRef.current = marker;

      // Attach click listener once delegation
      clickListenerRef.current = marker.addListener('click', () => {
        onClickRef.current?.();
      });
    }

    return () => {
      if (clickListenerRef.current) {
        google.maps.event.removeListener(clickListenerRef.current);
        clickListenerRef.current = null;
      }
      if (markerRef.current) {
        markerRef.current.setMap(null);
        markerRef.current = null;
      }
    };
    // Marker creation lifecycle is bound to the google.maps.Map instance
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  // Update marker position and attributes in-place without re-creating
  useEffect(() => {
    if (!markerRef.current) return;
    markerRef.current.setPosition({ lat: posLat, lng: posLng });
    markerRef.current.setTitle(title || '');
    if (icon) markerRef.current.setIcon(icon);
    if (typeof zIndex === 'number') markerRef.current.setZIndex(zIndex);
  }, [posLat, posLng, title, icon, zIndex]);

  return null;
}
