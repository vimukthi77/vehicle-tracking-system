'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  MapPin, 
  Clock, 
  Play, 
  CheckCircle, 
  User, 
  Navigation, 
  Route, 
  Car, 
  Truck,
  Activity,
  Eye,
  Target,
  ArrowRight,
  Gauge,
  Signal,
  Phone,
  Calendar,
  RefreshCw,
  Map
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { toast } from 'sonner';
import GoogleMap from '@/components/GoogleMap';

interface Ride {
  _id: string;
  userId: string;
  userName?: string;
  driverId?: string;
  driverName?: string;
  vehicleId?: string;
  vehicleName?: string;
  status: string;
  distanceKm?: number;
  startLocation: { 
    address: string;
    latitude?: number;
    longitude?: number;
  };
  endLocation: { 
    address: string;
    latitude?: number;
    longitude?: number;
  };
  createdAt: string;
  estimatedDuration?: number;
  currentLocation?: {
    latitude: number;
    longitude: number;
    timestamp: string;
  };
}

interface Vehicle {
  _id: string;
  terminalId: string;
  vehicle: string;
  vehicleType: string;
  status: string;
  latitude: string;
  longitude: string;
  speed: number;
  lastMessage: string;
  expire: string;
  phone?: string;
  speedLimit?: number;
}

export default function DriverDashboard() {
  const [rides, setRides] = useState<Ride[]>([]);
  const [assignedVehicle, setAssignedVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRideForMap, setSelectedRideForMap] = useState<Ride | null>(null);
  const [isMapDialogOpen, setIsMapDialogOpen] = useState(false);

  useEffect(() => {
    fetchDriverData();
    const interval = setInterval(fetchDriverData, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchDriverData = async () => {
    try {
      setRefreshing(true);
      
      // Fetch assigned rides
      const ridesResponse = await fetch('/api/driver/rides');
      if (ridesResponse.ok) {
        const ridesData = await ridesResponse.json();
        setRides(ridesData);
      }

      // Fetch assigned vehicle
      const vehicleResponse = await fetch('/api/driver/vehicle');
      if (vehicleResponse.ok) {
        const vehicleData = await vehicleResponse.json();
        setAssignedVehicle(vehicleData);
      }

      if (!loading) {
        toast.success('Data updated successfully');
      }
    } catch (error) {
      console.error('Failed to fetch driver data:', error);
      if (!loading) {
        toast.error('Failed to update data');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const updateRideStatus = async (rideId: string, status: string) => {
    try {
      const response = await fetch(`/api/rides/${rideId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (response.ok) {
        fetchDriverData();
        toast.success(`Ride ${status.replace('_', ' ')} successfully`);
      } else {
        toast.error('Failed to update ride status');
      }
    } catch (error) {
      console.error('Failed to update ride status:', error);
      toast.error('Failed to update ride status');
    }
  };

  const openRideMap = (ride: Ride) => {
    setSelectedRideForMap(ride);
    setIsMapDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const statusConfigs = {
      approved: { color: 'bg-green-100 text-green-800 border-green-300', icon: CheckCircle },
      in_progress: { color: 'bg-blue-100 text-blue-800 border-blue-300', icon: Activity },
      completed: { color: 'bg-gray-100 text-gray-800 border-gray-300', icon: CheckCircle },
    };
    
    const config = statusConfigs[status as keyof typeof statusConfigs] || statusConfigs.approved;
    const IconComponent = config.icon;
    
    return (
      <Badge className={`${config.color} border flex items-center gap-1`}>
        <IconComponent className="w-3 h-3" />
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  const getVehicleIcon = (vehicleType: string) => {
    const icons = {
      truck: '🚛',
      car: '🚗',
      van: '🚐',
      bike: '🏍️',
      bus: '🚌'
    };
    return icons[vehicleType?.toLowerCase() as keyof typeof icons] || '🚙';
  };

  const getRideType = (distance?: number): { type: 'short' | 'long' | 'unknown', color: string, icon: string } => {
    if (!distance || isNaN(distance)) {
      return { type: 'unknown', color: 'bg-gray-100 text-gray-800', icon: '❓' };
    }
    
    if (distance <= 50) {
      return { type: 'short', color: 'bg-green-100 text-green-800', icon: '🚗' };
    } else {
      return { type: 'long', color: 'bg-blue-100 text-blue-800', icon: '🛣️' };
    }
  };

  const formatDistance = (distance?: number): string => {
    if (distance === undefined || distance === null || isNaN(distance)) {
      return 'N/A';
    }
    return `${distance.toFixed(1)} km`;
  };

  const canStartRide = (status: string) => status === 'approved';
  const canCompleteRide = (status: string) => status === 'in_progress';

  // Map Dialog Component
  const RideMapDialog = () => {
    if (!selectedRideForMap) return null;

    const ride = selectedRideForMap;
    const rideType = getRideType(ride.distanceKm);

    // Create map devices array with vehicle and route points
    const mapDevices = [];
    
    // Add assigned vehicle if available
    if (assignedVehicle) {
      mapDevices.push({
        ...assignedVehicle,
        isAssignedVehicle: true
      });
    }

    // Add start and end locations as map points
    if (ride.startLocation.latitude && ride.startLocation.longitude) {
      mapDevices.push({
        _id: `start-${ride._id}`,
        terminalId: 'START',
        vehicle: 'Pickup Location',
        vehicleType: 'location',
        status: 'pickup',
        latitude: ride.startLocation.latitude.toString(),
        longitude: ride.startLocation.longitude.toString(),
        speed: 0,
        lastMessage: new Date().toISOString(),
        expire: '',
        address: ride.startLocation.address
      });
    }

    if (ride.endLocation.latitude && ride.endLocation.longitude) {
      mapDevices.push({
        _id: `end-${ride._id}`,
        terminalId: 'END',
        vehicle: 'Drop-off Location',
        vehicleType: 'location',
        status: 'dropoff',
        latitude: ride.endLocation.latitude.toString(),
        longitude: ride.endLocation.longitude.toString(),
        speed: 0,
        lastMessage: new Date().toISOString(),
        expire: '',
        address: ride.endLocation.address
      });
    }

    return (
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Navigation className="w-6 h-6 text-blue-600" />
            Ride Route - Trip #{ride._id.slice(-6)}
          </DialogTitle>
          <DialogDescription>
            Interactive map showing pickup, destination, and assigned vehicle location
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Trip Overview */}
          <Card>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-3">
                  <h4 className="font-semibold text-gray-900">Trip Information</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Passenger:</span>
                      <span className="font-medium">{ride.userName || 'N/A'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Distance:</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{formatDistance(ride.distanceKm)}</span>
                        <Badge className={`${rideType.color} text-xs`}>
                          {rideType.icon} {rideType.type}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Status:</span>
                      {getStatusBadge(ride.status)}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Est. Duration:</span>
                      <span className="font-medium">{ride.estimatedDuration || Math.round((ride.distanceKm || 0) * 2)} min</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-semibold text-gray-900">Assigned Vehicle</h4>
                  {assignedVehicle ? (
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-2xl">{getVehicleIcon(assignedVehicle.vehicleType)}</span>
                        <div>
                          <p className="font-medium">{assignedVehicle.vehicle}</p>
                          <p className="text-xs text-gray-500 capitalize">{assignedVehicle.vehicleType}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-gray-600">Speed:</span>
                          <span className="font-medium ml-1">{assignedVehicle.speed} km/h</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Status:</span>
                          <span className={`font-medium ml-1 ${
                            assignedVehicle.status === 'online' ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {assignedVehicle.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-gray-50 rounded-lg text-center">
                      <p className="text-sm text-gray-500">No vehicle assigned</p>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <h4 className="font-semibold text-gray-900">Route Details</h4>
                  <div className="space-y-3">
                    <div className="p-3 bg-green-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <MapPin className="w-4 h-4 text-green-600" />
                        <span className="text-sm font-medium text-green-800">Pickup</span>
                      </div>
                      <p className="text-xs text-gray-700">{ride.startLocation.address}</p>
                    </div>
                    <div className="flex justify-center">
                      <ArrowRight className="w-5 h-5 text-gray-400" />
                    </div>
                    <div className="p-3 bg-red-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <MapPin className="w-4 h-4 text-red-600" />
                        <span className="text-sm font-medium text-red-800">Destination</span>
                      </div>
                      <p className="text-xs text-gray-700">{ride.endLocation.address}</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Interactive Map */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Map className="w-5 h-5" />
                Route Map
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="w-full h-96 rounded-lg overflow-hidden">
                <GoogleMap 
                  devices={mapDevices as any} 
                  onDeviceSelect={() => {}}
                  height="100%" 
                />
              </div>
              <div className="mt-4 flex items-center justify-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span>Pickup Location</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span>Your Vehicle</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span>Destination</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              My Assigned Rides
            </h1>
            <p className="text-gray-600 mt-1">Manage your ride assignments and track your vehicle</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-base px-4 py-2 bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
              <Activity className="w-4 h-4 mr-2" />
              {rides.length} Active Rides
            </Badge>
            <Button 
              variant="outline" 
              onClick={fetchDriverData}
              disabled={refreshing}
              size="sm"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Assigned Vehicle Card */}
        {assignedVehicle && (
          <Card className="border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Car className="w-5 h-5 text-blue-600" />
                Your Assigned Vehicle
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-blue-100 rounded-xl flex items-center justify-center">
                    <span className="text-3xl">{getVehicleIcon(assignedVehicle.vehicleType)}</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">{assignedVehicle.vehicle}</h3>
                    <p className="text-sm text-gray-600 capitalize">{assignedVehicle.vehicleType} Vehicle</p>
                    <p className="text-xs text-gray-500">Terminal: {assignedVehicle.terminalId}</p>
                  </div>
                </div>
                <div className="text-right">
                  <Badge className={`mb-2 ${
                    assignedVehicle.status === 'online' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {assignedVehicle.status.toUpperCase()}
                  </Badge>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-2">
                      <Gauge className="w-4 h-4 text-gray-500" />
                      <span>{assignedVehicle.speed} km/h</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-gray-500" />
                      <span className="font-mono text-xs">
                        {parseFloat(assignedVehicle.latitude).toFixed(3)}, {parseFloat(assignedVehicle.longitude).toFixed(3)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Rides List */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="text-lg">Loading rides...</div>
          </div>
        ) : rides.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <User className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-600 mb-2">No rides assigned</h3>
              <p className="text-gray-500">You don't have any rides assigned at the moment.</p>
              {!assignedVehicle && (
                <p className="text-gray-500 mt-2">Contact admin to get a vehicle assigned.</p>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {rides.map((ride) => {
              const rideType = getRideType(ride.distanceKm);
              return (
                <Card key={ride._id} className="border-l-4 border-l-blue-500 hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <CardTitle className="text-lg">Ride #{ride._id.slice(-6)}</CardTitle>
                          <Badge className={`${rideType.color} text-xs`}>
                            {rideType.icon} {rideType.type} distance
                          </Badge>
                        </div>
                        <CardDescription>
                          Passenger: <span className="font-medium">{ride.userName || 'Unknown'}</span> • 
                          Requested on {new Date(ride.createdAt).toLocaleDateString()}
                        </CardDescription>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {getStatusBadge(ride.status)}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openRideMap(ride)}
                          className="flex items-center gap-2"
                        >
                          <Eye className="w-4 h-4" />
                          View Route
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-3">
                          <div className="flex items-start gap-3">
                            <MapPin className="w-5 h-5 text-green-600 mt-0.5" />
                            <div>
                              <p className="font-medium text-sm">Pickup Location</p>
                              <p className="text-gray-600">{ride.startLocation.address}</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3">
                            <MapPin className="w-5 h-5 text-red-600 mt-0.5" />
                            <div>
                              <p className="font-medium text-sm">Destination</p>
                              <p className="text-gray-600">{ride.endLocation.address}</p>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <Route className="w-4 h-4 text-gray-500" />
                            <span className="text-sm text-gray-600">
                              Distance: <span className="font-medium">{formatDistance(ride.distanceKm)}</span>
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-gray-500" />
                            <span className="text-sm text-gray-600">
                              Est. Duration: <span className="font-medium">
                                {ride.estimatedDuration || Math.round((ride.distanceKm || 0) * 2)} min
                              </span>
                            </span>
                          </div>
                          {ride.vehicleName && (
                            <div className="flex items-center gap-2">
                              <Car className="w-4 h-4 text-gray-500" />
                              <span className="text-sm text-gray-600">
                                Vehicle: <span className="font-medium">{ride.vehicleName}</span>
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-3 pt-4 border-t">
                        {canStartRide(ride.status) && (
                          <Button
                            onClick={() => updateRideStatus(ride._id, 'in_progress')}
                            className="flex items-center gap-2 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800"
                          >
                            <Play className="w-4 h-4" />
                            Start Ride
                          </Button>
                        )}
                        {canCompleteRide(ride.status) && (
                          <Button
                            onClick={() => updateRideStatus(ride._id, 'completed')}
                            variant="outline"
                            className="flex items-center gap-2 border-green-300 text-green-700 hover:bg-green-50"
                          >
                            <CheckCircle className="w-4 h-4" />
                            Complete Ride
                          </Button>
                        )}
                        {ride.status === 'completed' && (
                          <Badge variant="secondary" className="flex items-center gap-2 px-4 py-2">
                            <CheckCircle className="w-4 h-4" />
                            Completed
                          </Badge>
                        )}
                        <Button
                          variant="ghost"
                          onClick={() => openRideMap(ride)}
                          className="flex items-center gap-2"
                        >
                          <Navigation className="w-4 h-4" />
                          Show Route
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Map Dialog */}
        <Dialog open={isMapDialogOpen} onOpenChange={setIsMapDialogOpen}>
          <RideMapDialog />
        </Dialog>
      </div>
    </DashboardLayout>
  );
}