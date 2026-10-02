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

  useEffect(() => {
    if (!map) return;

    if (!markerRef.current) {
      markerRef.current = new google.maps.Marker({
        position,
        map,
        title,
        icon,
        zIndex,
      });
    } else {
      markerRef.current.setPosition(position);
      markerRef.current.setTitle(title || '');
      if (icon) markerRef.current.setIcon(icon);
      if (typeof zIndex === 'number') markerRef.current.setZIndex(zIndex);
      markerRef.current.setMap(map);
    }

    // Attach click listener
    if (clickListenerRef.current) {
      google.maps.event.removeListener(clickListenerRef.current);
      clickListenerRef.current = null;
    }

    if (onClick && markerRef.current) {
      clickListenerRef.current = markerRef.current.addListener('click', onClick);
    }

    return () => {
      if (clickListenerRef.current) {
        google.maps.event.removeListener(clickListenerRef.current);
        clickListenerRef.current = null;
      }
      if (markerRef.current) {
        markerRef.current.setMap(null);
      }
    };
  }, [map, position, title, icon, onClick, zIndex]);

  // Clean unmount
  useEffect(() => {
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
  }, []);

  return null;
}
