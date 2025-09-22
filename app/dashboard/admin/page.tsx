'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  MapPin, 
  Clock, 
  Plus, 
  Users, 
  Car, 
  UserCheck, 
  Truck, 
  Settings, 
  Calendar,
  Activity,
  CheckCircle,
  AlertCircle,
  Search,
  Filter,
  RotateCcw,
  User,
  Shield,
  Phone,
  Mail,
  Navigation,
  Route,
  Eye,
  MapIcon,
  Target,
  ArrowRight,
  Zap,
  Timer,
  Play
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { toast } from 'sonner';

interface User {
  _id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
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
  currentLocation?: {
    latitude: number;
    longitude: number;
    timestamp: string;
  };
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
  approvalFlow?: 'direct' | 'pm_approved'; // Shows if it came directly or through PM
  estimatedDuration?: number; // in minutes
  actualRoute?: Array<{ latitude: number; longitude: number; timestamp: string }>;
}

export default function AdminDashboard() {
  const [rides, setRides] = useState<Ride[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('assignments');
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [isLiveTrackingOpen, setIsLiveTrackingOpen] = useState(false);
  const [selectedRideForTracking, setSelectedRideForTracking] = useState<Ride | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    role: 'driver'
  });

  // Helper function to safely format distance
  const formatDistance = (distance?: number): string => {
    if (distance === undefined || distance === null || isNaN(distance)) {
      return 'N/A';
    }
    return `${distance.toFixed(1)} km`;
  };

  // Helper function to determine ride type based on distance
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

  // Helper function to get approval flow badge
  const getApprovalFlowBadge = (flow?: string) => {
    if (flow === 'direct') {
      return <Badge className="bg-orange-100 text-orange-800 text-xs">Direct to Admin</Badge>;
    } else if (flow === 'pm_approved') {
      return <Badge className="bg-purple-100 text-purple-800 text-xs">Via PM Approval</Badge>;
    }
    return <Badge className="bg-gray-100 text-gray-800 text-xs">Unknown Flow</Badge>;
  };

  useEffect(() => {
    fetchData();
    // Set up real-time updates for ongoing rides
    const interval = setInterval(() => {
      updateOngoingRides();
    }, 30000); // Update every 30 seconds
    
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [ridesRes, usersRes, vehiclesRes] = await Promise.all([
        fetch('/api/rides'),
        fetch('/api/users'),
        fetch('/api/devices')
      ]);

      if (ridesRes.ok) {
        const ridesData = await ridesRes.json();
        const processedRides = ridesData.map((ride: any) => ({
          ...ride,
          distanceKm: typeof ride.distanceKm === 'number' ? ride.distanceKm : 0,
          approvalFlow: ride.approvalFlow || 'direct', // Default to direct if not specified
          estimatedDuration: ride.estimatedDuration || Math.round((ride.distanceKm || 0) * 2), // Rough estimate
        }));
        setRides(processedRides);
      }

      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(usersData);
        setDrivers(usersData.filter((user: User) => user.role === 'driver'));
      }

      if (vehiclesRes.ok) {
        const vehiclesData = await vehiclesRes.json();
        setVehicles(vehiclesData);
      }

      toast.success('Data refreshed successfully');
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const updateOngoingRides = async () => {
    try {
      const ongoingRides = rides.filter(ride => ride.status === 'in_progress');
      if (ongoingRides.length === 0) return;

      const updates = await Promise.all(
        ongoingRides.map(async (ride) => {
          const response = await fetch(`/api/rides/${ride._id}/location`);
          if (response.ok) {
            return await response.json();
          }
          return null;
        })
      );

      // Update rides with new location data
      setRides(prevRides => 
        prevRides.map(ride => {
          const update = updates.find(u => u && u.rideId === ride._id);
          if (update) {
            return {
              ...ride,
              currentLocation: update.currentLocation,
              actualRoute: update.route || ride.actualRoute
            };
          }
          return ride;
        })
      );
    } catch (error) {
      console.error('Failed to update ongoing rides:', error);
    }
  };

  const assignDriver = async (rideId: string, driverId: string) => {
    try {
      const response = await fetch(`/api/rides/${rideId}/assign-driver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId }),
      });

      if (response.ok) {
        toast.success('Driver assigned successfully');
        fetchData();
      } else {
        toast.error('Failed to assign driver');
      }
    } catch (error) {
      console.error('Failed to assign driver:', error);
      toast.error('Failed to assign driver');
    }
  };

  const assignVehicle = async (rideId: string, vehicleId: string) => {
    try {
      const response = await fetch(`/api/rides/${rideId}/assign-vehicle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vehicleId }),
      });

      if (response.ok) {
        toast.success('Vehicle assigned successfully');
        fetchData();
      } else {
        toast.error('Failed to assign vehicle');
      }
    } catch (error) {
      console.error('Failed to assign vehicle:', error);
      toast.error('Failed to assign vehicle');
    }
  };

  const createUser = async () => {
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
      });

      if (response.ok) {
        setIsCreateUserOpen(false);
        setNewUser({ name: '', email: '', password: '', role: 'driver' });
        toast.success('User created successfully');
        fetchData();
      } else {
        toast.error('Failed to create user');
      }
    } catch (error) {
      console.error('Failed to create user:', error);
      toast.error('Failed to create user');
    }
  };

  const openLiveTracking = (ride: Ride) => {
    setSelectedRideForTracking(ride);
    setIsLiveTrackingOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const statusConfigs = {
      pending: { color: 'bg-yellow-100 text-yellow-800 border-yellow-300', icon: Clock },
      awaiting_pm: { color: 'bg-blue-100 text-blue-800 border-blue-300', icon: User },
      awaiting_admin: { color: 'bg-orange-100 text-orange-800 border-orange-300', icon: Shield },
      approved: { color: 'bg-green-100 text-green-800 border-green-300', icon: CheckCircle },
      in_progress: { color: 'bg-purple-100 text-purple-800 border-purple-300', icon: Activity },
      completed: { color: 'bg-gray-100 text-gray-800 border-gray-300', icon: CheckCircle },
      rejected: { color: 'bg-red-100 text-red-800 border-red-300', icon: AlertCircle },
    };
    
    const config = statusConfigs[status as keyof typeof statusConfigs] || statusConfigs.pending;
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
    return icons[vehicleType.toLowerCase() as keyof typeof icons] || '🚙';
  };

  const getVehicleStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'text-green-600 bg-green-100';
      case 'offline': return 'text-red-600 bg-red-100';
      case 'idle': return 'text-yellow-600 bg-yellow-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  // Live Tracking Modal Component
  const LiveTrackingModal = () => {
    if (!selectedRideForTracking) return null;

    const ride = selectedRideForTracking;
    const rideType = getRideType(ride.distanceKm);

    return (
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Navigation className="w-6 h-6 text-blue-600" />
            Live Trip Tracking - Ride #{ride._id.slice(-6)}
          </DialogTitle>
          <DialogDescription>
            Real-time location and route tracking for ongoing trip
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Trip Overview */}
          <Card>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-3">
                  <h4 className="font-semibold text-gray-900">Trip Details</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Passenger:</span>
                      <span className="font-medium">{ride.userName}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Driver:</span>
                      <span className="font-medium">{ride.driverName || 'N/A'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Vehicle:</span>
                      <span className="font-medium">{ride.vehicleName || 'N/A'}</span>
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
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-semibold text-gray-900">Route Information</h4>
                  <div className="space-y-3">
                    <div className="p-3 bg-green-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <MapPin className="w-4 h-4 text-green-600" />
                        <span className="text-sm font-medium text-green-800">From</span>
                      </div>
                      <p className="text-sm text-gray-700">{ride.startLocation.address}</p>
                    </div>
                    <div className="p-3 bg-red-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <MapPin className="w-4 h-4 text-red-600" />
                        <span className="text-sm font-medium text-red-800">To</span>
                      </div>
                      <p className="text-sm text-gray-700">{ride.endLocation.address}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-semibold text-gray-900">Live Status</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      {getStatusBadge(ride.status)}
                    </div>
                    {ride.currentLocation && (
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <Target className="w-4 h-4 text-blue-600" />
                          <span className="text-sm font-medium text-blue-800">Current Location</span>
                        </div>
                        <p className="text-xs font-mono text-gray-600">
                          {ride.currentLocation.latitude.toFixed(6)}, {ride.currentLocation.longitude.toFixed(6)}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Last updated: {new Date(ride.currentLocation.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Est. Duration:</span>
                      <span className="font-medium">{ride.estimatedDuration} min</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Map Container */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapIcon className="w-5 h-5" />
                Live Route Tracking
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="w-full h-96 bg-gray-100 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300">
                <div className="text-center">
                  <MapIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-700 mb-2">Interactive Map</h3>
                  <p className="text-gray-500 mb-4">
                    Live tracking map showing route from start to destination
                  </p>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <span>Start Location</span>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                      <span>Current Position</span>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                      <span>Destination</span>
                    </div>
                  </div>
                </div>
              </div>
              {/* You would integrate your actual map component here */}
              {/* For example: <GoogleMap route={ride.actualRoute} currentLocation={ride.currentLocation} /> */}
            </CardContent>
          </Card>

          {/* Route Progress */}
          {ride.actualRoute && ride.actualRoute.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Route className="w-5 h-5" />
                  Route Progress
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Progress:</span>
                    <span className="font-medium">65% Complete</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-blue-600 h-2 rounded-full" style={{ width: '65%' }}></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Distance Covered:</span>
                      <span className="font-medium ml-2">{((ride.distanceKm || 0) * 0.65).toFixed(1)} km</span>
                    </div>
                    <div>
                      <span className="text-gray-600">ETA:</span>
                      <span className="font-medium ml-2">
                        {new Date(Date.now() + (ride.estimatedDuration || 0) * 60000 * 0.35).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    );
  };

  // Filter rides based on status and search
  const filteredRides = rides.filter(ride => {
    const matchesSearch = ride.userName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         ride.driverName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         ride.vehicleName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         ride._id.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || ride.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Separate user requests from admin-approved rides
  const userRequests = filteredRides.filter(ride => ['pending', 'awaiting_pm', 'awaiting_admin'].includes(ride.status));
  const adminApprovedRides = filteredRides.filter(ride => ['approved', 'in_progress', 'completed'].includes(ride.status));
  const ongoingRides = filteredRides.filter(ride => ride.status === 'in_progress');
  const availableDrivers = drivers.filter(driver => !rides.some(ride => ride.driverId === driver._id && ['approved', 'in_progress'].includes(ride.status)));
  const availableVehicles = vehicles.filter(vehicle => vehicle.status === 'online' && !rides.some(ride => ride.vehicleId === vehicle._id && ['approved', 'in_progress'].includes(ride.status)));

  const pendingAssignments = adminApprovedRides.filter(ride => !ride.driverId || !ride.vehicleId);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Admin Dashboard
            </h1>
            <p className="text-gray-600 mt-1">Assign drivers and vehicles to approved rides • Track ongoing trips</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={fetchData} disabled={loading}>
              <RotateCcw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Dialog open={isCreateUserOpen} onOpenChange={setIsCreateUserOpen}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Create User
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Create New User</DialogTitle>
                  <DialogDescription>
                    Create a new driver or project manager account
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      placeholder="Enter full name"
                      value={newUser.name}
                      onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="Enter email address"
                      value={newUser.email}
                      onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Enter password"
                      value={newUser.password}
                      onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="role">Role</Label>
                    <Select value={newUser.role} onValueChange={(value) => setNewUser({ ...newUser, role: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="driver">Driver</SelectItem>
                        <SelectItem value="project_manager">Project Manager</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={createUser} className="w-full">
                    Create User
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center">
                  <Settings className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Pending Assignments</p>
                  <p className="text-2xl font-bold text-orange-600">{pendingAssignments.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Available Drivers</p>
                  <p className="text-2xl font-bold text-green-600">{availableDrivers.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center">
                  <Truck className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Available Vehicles</p>
                  <p className="text-2xl font-bold text-blue-600">{availableVehicles.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-purple-500 rounded-xl flex items-center justify-center">
                  <Activity className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Rides</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {rides.filter(ride => ['approved', 'in_progress'].includes(ride.status)).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-indigo-50 to-indigo-100 border-indigo-200">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-indigo-500 rounded-xl flex items-center justify-center">
                  <Navigation className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Live Tracking</p>
                  <p className="text-2xl font-bold text-indigo-600">{ongoingRides.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Ongoing Trips - Live Tracking Section */}
        {ongoingRides.length > 0 && (
          <Card className="border-2 border-indigo-200 bg-gradient-to-r from-indigo-50 to-purple-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Play className="w-5 h-5 text-indigo-600" />
                Ongoing Trips - Live Tracking
                <Badge className="bg-indigo-100 text-indigo-800 ml-2">
                  {ongoingRides.length} Active
                </Badge>
              </CardTitle>
              <CardDescription>
                Monitor and track all trips currently in progress
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {ongoingRides.map((ride) => {
                  const rideType = getRideType(ride.distanceKm);
                  return (
                    <div key={ride._id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                          <h4 className="font-medium">Trip #{ride._id.slice(-6)}</h4>
                          <Badge className={`${rideType.color} text-xs`}>
                            {rideType.icon} {rideType.type} distance
                          </Badge>
                          {getApprovalFlowBadge(ride.approvalFlow)}
                        </div>
                        <Button 
                          size="sm" 
                          onClick={() => openLiveTracking(ride)}
                          className="bg-indigo-600 hover:bg-indigo-700"
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          Live Track
                        </Button>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Passenger:</span>
                          <span className="font-medium ml-2">{ride.userName}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Driver:</span>
                          <span className="font-medium ml-2">{ride.driverName}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Vehicle:</span>
                          <span className="font-medium ml-2">{ride.vehicleName}</span>
                        </div>
                      </div>
                      
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-green-600" />
                            <span className="text-gray-600">From:</span>
                            <span className="font-medium">{ride.startLocation.address}</span>
                          </div>
                          <ArrowRight className="w-4 h-4 text-gray-400" />
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-red-600" />
                            <span className="text-gray-600">To:</span>
                            <span className="font-medium">{ride.endLocation.address}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <div className="border-b bg-white rounded-lg p-1">
          <div className="flex space-x-1">
            {[
              { key: 'assignments', label: 'Driver & Vehicle Assignment', icon: Settings },
              { key: 'requests', label: 'User Requests', icon: User },
              { key: 'users', label: 'User Management', icon: Users },
              { key: 'vehicles', label: 'Vehicle Fleet', icon: Truck }
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  activeTab === key
                    ? 'bg-blue-100 text-blue-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Search and Filter */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search by user, driver, vehicle, or ride ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="awaiting_pm">Awaiting PM</SelectItem>
                  <SelectItem value="awaiting_admin">Awaiting Admin</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Driver & Vehicle Assignment Tab */}
        {activeTab === 'assignments' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Pending Assignments
                </CardTitle>
                <CardDescription>
                  Assign drivers and vehicles to approved rides ({pendingAssignments.length} pending)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {pendingAssignments.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">All Assignments Complete</h3>
                    <p className="text-gray-500">No rides need driver or vehicle assignment at this time.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {pendingAssignments.map((ride) => {
                      const rideType = getRideType(ride.distanceKm);
                      return (
                        <div key={ride._id} className="border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow">
                          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h4 className="text-lg font-semibold">Ride #{ride._id.slice(-6)}</h4>
                                {getStatusBadge(ride.status)}
                                <Badge className={`${rideType.color} text-xs`}>
                                  {rideType.icon} {rideType.type} distance
                                </Badge>
                              </div>
                              <p className="text-sm text-gray-600">
                                Requested by: <span className="font-medium">{ride.userName || 'Unknown User'}</span>
                              </p>
                              <div className="flex items-center gap-4 mt-1">
                                <p className="text-sm text-gray-600">
                                  Distance: <span className="font-medium">{formatDistance(ride.distanceKm)}</span>
                                </p>
                                <p className="text-sm text-gray-600">
                                  Date: <span className="font-medium">{new Date(ride.createdAt).toLocaleDateString()}</span>
                                </p>
                                {getApprovalFlowBadge(ride.approvalFlow)}
                              </div>
                            </div>
                          </div>

                          <div className="grid lg:grid-cols-2 gap-6 mb-6">
                            <div className="space-y-3">
                              <div className="flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-green-600" />
                                <span className="text-sm font-medium">From:</span>
                              </div>
                              <p className="text-sm text-gray-700 pl-6">{ride.startLocation.address}</p>
                            </div>
                            <div className="space-y-3">
                              <div className="flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-red-600" />
                                <span className="text-sm font-medium">To:</span>
                              </div>
                              <p className="text-sm text-gray-700 pl-6">{ride.endLocation.address}</p>
                            </div>
                          </div>

                          <div className="grid lg:grid-cols-2 gap-6">
                            {/* Driver Assignment */}
                            <div className="space-y-3">
                              <Label className="text-sm font-medium">Assign Driver</Label>
                              {ride.driverId ? (
                                <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                                  <UserCheck className="w-5 h-5 text-green-600" />
                                  <span className="text-sm font-medium text-green-800">
                                    {ride.driverName || 'Assigned Driver'}
                                  </span>
                                </div>
                              ) : (
                                <Select onValueChange={(driverId) => assignDriver(ride._id, driverId)}>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select available driver" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {availableDrivers.map((driver) => (
                                      <SelectItem key={driver._id} value={driver._id}>
                                        <div className="flex items-center gap-2">
                                          <User className="w-4 h-4" />
                                          {driver.name}
                                        </div>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            </div>

                            {/* Vehicle Assignment */}
                            <div className="space-y-3">
                              <Label className="text-sm font-medium">Assign Vehicle</Label>
                              {ride.vehicleId ? (
                                <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                                  <Car className="w-5 h-5 text-green-600" />
                                  <span className="text-sm font-medium text-green-800">
                                    {ride.vehicleName || 'Assigned Vehicle'}
                                  </span>
                                </div>
                              ) : (
                                <Select onValueChange={(vehicleId) => assignVehicle(ride._id, vehicleId)}>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select available vehicle" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {availableVehicles.map((vehicle) => (
                                      <SelectItem key={vehicle._id} value={vehicle._id}>
                                        <div className="flex items-center gap-2">
                                          <span className="text-lg">{getVehicleIcon(vehicle.vehicleType)}</span>
                                          <div>
                                            <span className="font-medium">{vehicle.vehicle}</span>
                                            <span className="text-xs text-gray-500 ml-2">({vehicle.vehicleType})</span>
                                          </div>
                                        </div>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* User Requests Tab */}
        {activeTab === 'requests' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                User Ride Requests
              </CardTitle>
              <CardDescription>
                View all incoming ride requests from users ({userRequests.length} requests)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {userRequests.length === 0 ? (
                <div className="text-center py-12">
                  <Clock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Pending Requests</h3>
                  <p className="text-gray-500">All user requests have been processed.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {userRequests.map((ride) => {
                    const rideType = getRideType(ride.distanceKm);
                    return (
                      <div key={ride._id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <div className="flex items-center gap-3 mb-2">
                              <h4 className="font-medium">Ride #{ride._id.slice(-6)}</h4>
                              <Badge className={`${rideType.color} text-xs`}>
                                {rideType.icon} {rideType.type}
                              </Badge>
                              {getApprovalFlowBadge(ride.approvalFlow)}
                            </div>
                            <p className="text-sm text-gray-600">
                              Requested by: <span className="font-medium">{ride.userName || 'Unknown User'}</span>
                            </p>
                            <p className="text-sm text-gray-600">
                              {formatDistance(ride.distanceKm)} • {new Date(ride.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          {getStatusBadge(ride.status)}
                        </div>
                        <div className="grid md:grid-cols-2 gap-3">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-green-600" />
                            <span className="text-sm">{ride.startLocation.address}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-red-600" />
                            <span className="text-sm">{ride.endLocation.address}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* User Management Tab */}
        {activeTab === 'users' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                User Management
              </CardTitle>
              <CardDescription>
                Manage drivers and project managers ({users.filter(u => u.role !== 'user').length} users)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.filter(user => user.role !== 'user').map((user) => (
                      <TableRow key={user._id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center">
                              <User className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                              <p className="font-medium">{user.name}</p>
                              <p className="text-sm text-gray-500">ID: {user._id.slice(-6)}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Mail className="w-4 h-4 text-gray-400" />
                              <span className="text-sm">{user.email}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {user.role.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {user.role === 'driver' ? (
                            availableDrivers.some(d => d._id === user._id) ? (
                              <Badge className="bg-green-100 text-green-800">Available</Badge>
                            ) : (
                              <Badge className="bg-yellow-100 text-yellow-800">Assigned</Badge>
                            )
                          ) : (
                            <Badge className="bg-blue-100 text-blue-800">Active</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <span className="text-sm">{new Date(user.createdAt).toLocaleDateString()}</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Vehicle Fleet Tab */}
        {activeTab === 'vehicles' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="w-5 h-5" />
                Vehicle Fleet
              </CardTitle>
              <CardDescription>
                Monitor and manage your vehicle fleet ({vehicles.length} vehicles)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {vehicles.map((vehicle) => (
                  <div key={vehicle._id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-purple-100 rounded-lg flex items-center justify-center">
                          <span className="text-xl">{getVehicleIcon(vehicle.vehicleType)}</span>
                        </div>
                        <div>
                          <p className="font-medium">{vehicle.vehicle}</p>
                          <p className="text-xs text-gray-500 capitalize">{vehicle.vehicleType}</p>
                        </div>
                      </div>
                      <Badge className={`${getVehicleStatusColor(vehicle.status)} text-xs`}>
                        {vehicle.status}
                      </Badge>
                    </div>
                    
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Speed:</span>
                        <span className="font-medium">{vehicle.speed || 0} km/h</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Terminal:</span>
                        <span className="font-mono text-xs">{vehicle.terminalId.slice(-6)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Availability:</span>
                        <span className={`text-xs font-medium ${
                          availableVehicles.some(v => v._id === vehicle._id) 
                            ? 'text-green-600' 
                            : 'text-yellow-600'
                        }`}>
                          {availableVehicles.some(v => v._id === vehicle._id) ? 'Available' : 'Assigned'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Live Tracking Modal */}
        <Dialog open={isLiveTrackingOpen} onOpenChange={setIsLiveTrackingOpen}>
          <LiveTrackingModal />
        </Dialog>
      </div>
    </DashboardLayout>
  );
}