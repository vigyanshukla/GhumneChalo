'use client';

import { useEffect, useRef } from 'react';
import { decodePolyline, RouteCoordinate } from '@/lib/maps/routes';

export interface MapRoutePolylineProps {
  map: google.maps.Map | null;
  polyline: string;
  origin?: RouteCoordinate;
  destination?: RouteCoordinate;
  strokeColor?: string;
  strokeWeight?: number;
  strokeOpacity?: number;
  autoFitBounds?: boolean;
}

export function MapRoutePolyline({
  map,
  polyline,
  origin,
  destination,
  strokeColor = '#2563eb',
  strokeWeight = 5,
  strokeOpacity = 0.85,
  autoFitBounds = true,
}: MapRoutePolylineProps) {
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const originMarkerRef = useRef<google.maps.Marker | null>(null);
  const destinationMarkerRef = useRef<google.maps.Marker | null>(null);

  useEffect(() => {
    if (!map || !polyline) {
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
        polylineRef.current = null;
      }
      if (originMarkerRef.current) {
        originMarkerRef.current.setMap(null);
        originMarkerRef.current = null;
      }
      if (destinationMarkerRef.current) {
        destinationMarkerRef.current.setMap(null);
        destinationMarkerRef.current = null;
      }
      return;
    }

    const points = decodePolyline(polyline);
    if (points.length === 0) return;

    // 1. Render or update polyline
    if (!polylineRef.current) {
      polylineRef.current = new google.maps.Polyline({
        path: points,
        geodesic: true,
        strokeColor,
        strokeOpacity,
        strokeWeight,
        map,
        zIndex: 40,
      });
    } else {
      polylineRef.current.setPath(points);
      polylineRef.current.setOptions({
        strokeColor,
        strokeOpacity,
        strokeWeight,
      });
      polylineRef.current.setMap(map);
    }

    // 2. Render origin marker (Start indicator)
    const startPoint = origin || points[0];
    if (startPoint) {
      const originIcon: google.maps.Symbol = {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 7,
        fillColor: '#10b981', // Emerald green
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 2.5,
      };

      if (!originMarkerRef.current) {
        originMarkerRef.current = new google.maps.Marker({
          position: { lat: startPoint.lat, lng: startPoint.lng },
          map,
          title: startPoint.name || 'Route Origin',
          icon: originIcon,
          zIndex: 45,
        });
      } else {
        originMarkerRef.current.setPosition({ lat: startPoint.lat, lng: startPoint.lng });
        originMarkerRef.current.setIcon(originIcon);
        originMarkerRef.current.setTitle(startPoint.name || 'Route Origin');
        originMarkerRef.current.setMap(map);
      }
    }

    // 3. Render destination marker (End indicator)
    const endPoint = destination || points[points.length - 1];
    if (endPoint) {
      const destinationIcon: google.maps.Symbol = {
        path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
        scale: 5,
        fillColor: '#ef4444', // Red
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 2,
      };

      if (!destinationMarkerRef.current) {
        destinationMarkerRef.current = new google.maps.Marker({
          position: { lat: endPoint.lat, lng: endPoint.lng },
          map,
          title: endPoint.name || 'Route Destination',
          icon: destinationIcon,
          zIndex: 46,
        });
      } else {
        destinationMarkerRef.current.setPosition({ lat: endPoint.lat, lng: endPoint.lng });
        destinationMarkerRef.current.setIcon(destinationIcon);
        destinationMarkerRef.current.setTitle(endPoint.name || 'Route Destination');
        destinationMarkerRef.current.setMap(map);
      }
    }

    // 4. Fit map bounds to encompass full route
    if (autoFitBounds && points.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      points.forEach((pt) => bounds.extend(pt));
      map.fitBounds(bounds, {
        top: 60,
        right: 60,
        bottom: 80,
        left: 60,
      });
    }

    return () => {
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
        polylineRef.current = null;
      }
      if (originMarkerRef.current) {
        originMarkerRef.current.setMap(null);
        originMarkerRef.current = null;
      }
      if (destinationMarkerRef.current) {
        destinationMarkerRef.current.setMap(null);
        destinationMarkerRef.current = null;
      }
    };
  }, [map, polyline, origin, destination, strokeColor, strokeWeight, strokeOpacity, autoFitBounds]);

  return null;
}
