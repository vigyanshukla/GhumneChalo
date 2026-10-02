'use client';

import { useEffect, useRef } from 'react';

export interface UserLocation {
  lat: number;
  lng: number;
  accuracy?: number;
}

interface UserLocationMarkerProps {
  map: google.maps.Map | null;
  location: UserLocation | null;
  title?: string;
  showAccuracyCircle?: boolean;
}

/**
 * UserLocationMarker
 * 
 * Renders a distinct, accessible, high-visibility blue pulsing marker representing the user's current GPS location.
 * Distinct from destination markers.
 * Clean lifecycle: updates existing marker instance rather than recreating on every render.
 */
export function UserLocationMarker({
  map,
  location,
  title = 'Your Current Location',
  showAccuracyCircle = true,
}: UserLocationMarkerProps) {
  const markerRef = useRef<google.maps.Marker | null>(null);
  const circleRef = useRef<google.maps.Circle | null>(null);

  useEffect(() => {
    if (!map || !location) {
      if (markerRef.current) {
        markerRef.current.setMap(null);
        markerRef.current = null;
      }
      if (circleRef.current) {
        circleRef.current.setMap(null);
        circleRef.current = null;
      }
      return;
    }

    const pos = { lat: location.lat, lng: location.lng };

    // Create or update marker
    if (!markerRef.current) {
      // SVG Symbol for user dot: White outer ring + solid blue center
      const iconSymbol: google.maps.Symbol = {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: '#2563EB', // Blue-600
        fillOpacity: 1,
        strokeColor: '#FFFFFF',
        strokeWeight: 3,
      };

      markerRef.current = new google.maps.Marker({
        position: pos,
        map,
        title,
        icon: iconSymbol,
        zIndex: 999, // Ensure user dot floats above standard destination markers
      });
    } else {
      markerRef.current.setPosition(pos);
      markerRef.current.setMap(map);
    }

    // Optional accuracy halo
    if (showAccuracyCircle && location.accuracy) {
      if (!circleRef.current) {
        circleRef.current = new google.maps.Circle({
          strokeColor: '#3B82F6',
          strokeOpacity: 0.35,
          strokeWeight: 1,
          fillColor: '#60A5FA',
          fillOpacity: 0.15,
          map,
          center: pos,
          radius: Math.min(location.accuracy, 2000), // Cap visual radius at 2km
          zIndex: 998,
        });
      } else {
        circleRef.current.setCenter(pos);
        circleRef.current.setRadius(Math.min(location.accuracy, 2000));
        circleRef.current.setMap(map);
      }
    } else if (circleRef.current) {
      circleRef.current.setMap(null);
      circleRef.current = null;
    }

    return () => {
      // Cleanup on unmount or location change
      if (markerRef.current) {
        markerRef.current.setMap(null);
      }
      if (circleRef.current) {
        circleRef.current.setMap(null);
      }
    };
  }, [map, location, title, showAccuracyCircle]);

  // Clean cleanup on component removal
  useEffect(() => {
    return () => {
      if (markerRef.current) {
        markerRef.current.setMap(null);
        markerRef.current = null;
      }
      if (circleRef.current) {
        circleRef.current.setMap(null);
        circleRef.current = null;
      }
    };
  }, []);

  return null;
}
