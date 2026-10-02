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
  onClickRef.current = onClick;

  // Initialize marker on mount / when map becomes available
  useEffect(() => {
    if (!map) return;

    if (!markerRef.current) {
      const marker = new google.maps.Marker({
        position,
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
  }, [map]);

  // Update marker position and attributes in-place without re-creating
  useEffect(() => {
    if (!markerRef.current) return;
    markerRef.current.setPosition(position);
    markerRef.current.setTitle(title || '');
    if (icon) markerRef.current.setIcon(icon);
    if (typeof zIndex === 'number') markerRef.current.setZIndex(zIndex);
  }, [position.lat, position.lng, title, icon, zIndex]);

  return null;
}
