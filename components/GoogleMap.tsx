// components/GoogleMap.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, RefreshCw, Loader2 } from 'lucide-react';

interface Device {
  _id: string;
  terminalId: string;
  vehicle: string;
  vehicleType: string;
  status: string;
  latitude: string;
  longitude: string;
  speed: number;
  lastMessage: string;
}

interface GoogleMapProps {
  devices: Device[];
  onDeviceSelect?: (device: Device) => void;
  height?: string;
}

export default function GoogleMap({ devices, onDeviceSelect, height = '500px' }: GoogleMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    const initializeMap = () => {
      try {
        // Default center (Colombo, Sri Lanka)
        const defaultCenter = { lat: 6.9271, lng: 79.8612 };
        
        const map = new google.maps.Map(mapRef.current!, {
          center: defaultCenter,
          zoom: 12,
          mapTypeControl: true,
          streetViewControl: true,
          fullscreenControl: true,
          zoomControl: true,
          styles: [
            {
              featureType: 'poi',
              elementType: 'labels',
              stylers: [{ visibility: 'off' }]
            }
          ]
        });

        googleMapRef.current = map;
        setIsLoading(false);
        setError(null);
      } catch (err) {
        console.error('Map initialization error:', err);
        setError('Failed to initialize map');
        setIsLoading(false);
      }
    };

    if (window.google && window.google.maps) {
      initializeMap();
    } else {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`;
      script.onload = initializeMap;
      script.onerror = () => {
        setError('Failed to load Google Maps');
        setIsLoading(false);
      };
      document.head.appendChild(script);
    }
  }, []);

  useEffect(() => {
    if (!googleMapRef.current || devices.length === 0) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current.clear();

    const bounds = new google.maps.LatLngBounds();
    let hasValidCoordinates = false;

    devices.forEach(device => {
      const lat = parseFloat(device.latitude);
      const lng = parseFloat(device.longitude);

      if (isNaN(lat) || isNaN(lng)) return;

      hasValidCoordinates = true;
      const position = { lat, lng };
      bounds.extend(position);

      // Get vehicle icon and color based on status
      const getMarkerConfig = (status: string, vehicleType: string) => {
        const configs = {
          online: { color: '#10B981', icon: '🟢' },
          offline: { color: '#EF4444', icon: '🔴' },
          idle: { color: '#F59E0B', icon: '🟡' }
        };
        return configs[status as keyof typeof configs] || configs.offline;
      };

      const config = getMarkerConfig(device.status, device.vehicleType);

      // Create custom marker
      const marker = new google.maps.Marker({
        position,
        map: googleMapRef.current,
        title: `${device.vehicle} (${device.status})`,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: config.color,
          fillOpacity: 0.8,
          strokeColor: '#ffffff',
          strokeWeight: 2,
          scale: 8
        }
      });

      // Create info window
      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div class="p-3 min-w-[200px]">
            <div class="flex items-center gap-2 mb-2">
              <span class="text-lg">${getVehicleIcon(device.vehicleType)}</span>
              <h3 class="font-semibold text-gray-900">${device.vehicle}</h3>
            </div>
            <div class="space-y-1 text-sm text-gray-600">
              <p><strong>Status:</strong> <span class="capitalize">${device.status}</span></p>
              <p><strong>Speed:</strong> ${device.speed} km/h</p>
              <p><strong>Type:</strong> ${device.vehicleType}</p>
              <p><strong>Last Update:</strong> ${new Date(device.lastMessage).toLocaleTimeString()}</p>
            </div>
          </div>
        `
      });

      marker.addListener('click', () => {
        // Close all other info windows
        markersRef.current.forEach((_, key) => {
          if (key !== device._id) {
            // Info windows are handled per marker, so we just open this one
          }
        });
        infoWindow.open(googleMapRef.current, marker);
        
        if (onDeviceSelect) {
          onDeviceSelect(device);
        }
      });

      markersRef.current.set(device._id, marker);
    });

    // Fit map to show all markers
    if (hasValidCoordinates) {
      googleMapRef.current.fitBounds(bounds);
      
      // Ensure minimum zoom level
      const listener = google.maps.event.addListener(googleMapRef.current, 'idle', () => {
        const zoom = googleMapRef.current!.getZoom();
        if (zoom && zoom > 15) {
          googleMapRef.current!.setZoom(15);
        }
        google.maps.event.removeListener(listener);
      });
    }
  }, [devices, onDeviceSelect]);

  const getVehicleIcon = (vehicleType: string) => {
    const icons = {
      truck: '🚛',
      car: '🚗',
      van: '🚐',
      bike: '🏍️',
      bus: '🚌'
    };
    return icons[vehicleType.toLowerCase() as keyof typeof icons] || '🚙';
  };

  if (error) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <MapPin className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Map Error</h3>
          <p className="text-gray-500 mb-4">{error}</p>
          <Button onClick={() => window.location.reload()} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-600" />
            Live Vehicle Tracking Map
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-green-700 border-green-300">
              {devices.filter(d => d.status === 'online').length} Online
            </Badge>
            <Badge variant="outline" className="text-red-700 border-red-300">
              {devices.filter(d => d.status === 'offline').length} Offline
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="relative">
          <div 
            ref={mapRef} 
            style={{ height }}
            className="w-full"
          />
          {isLoading && (
            <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-2" />
                <p className="text-sm text-gray-600">Loading map...</p>
              </div>
            </div>
          )}
        </div>
        
        {/* Map Legend */}
        <div className="p-4 bg-gray-50 border-t">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span>Online</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span>Offline</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <span>Idle</span>
            </div>
            <div className="ml-auto text-xs text-gray-500">
              Click on markers for details • {devices.length} vehicles total
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}