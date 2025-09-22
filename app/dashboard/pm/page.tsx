'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MapPin, Clock, Check, X, AlertCircle, User, Navigation, Eye, Map, CheckCircle, Bell, MessageSquare } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { toast } from 'sonner';
import GoogleMap from '@/components/GoogleMap';

interface Ride {
  _id: string;
  userId: string;
  userName?: string;
  status: string;
  distanceKm: number;
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
  approvedAt?: string;
  pmApprovedBy?: string;
}

export default function ProjectManagerDashboard() {
  const [allRides, setAllRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRideForMap, setSelectedRideForMap] = useState<Ride | null>(null);
  const [isMapDialogOpen, setIsMapDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('pending');
  const [lastCheckTime, setLastCheckTime] = useState<Date>(new Date());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchAllRides();
    setupNotifications();
    
    // Cleanup interval on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const fetchAllRides = async () => {
    try {
      setLoading(true);
      // Fetch all rides that PM should see
      const response = await fetch('/api/rides/pm-dashboard');
      if (response.ok) {
        const data = await response.json();
        console.log('Fetched rides:', data);
        setAllRides(data);
      } else {
        // Fallback to regular rides endpoint
        const fallbackResponse = await fetch('/api/rides');
        if (fallbackResponse.ok) {
          const data = await fallbackResponse.json();
          console.log('Fallback rides:', data);
          setAllRides(data);
        }
      }
    } catch (error) {
      console.error('Failed to fetch rides:', error);
      toast.error('Failed to fetch rides');
    } finally {
      setLoading(false);
    }
  };

  const setupNotifications = () => {
    // Clear existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Check for new pending rides every 30 seconds
    intervalRef.current = setInterval(async () => {
      try {
        console.log('Checking for new rides...');
        const response = await fetch('/api/rides/check-new');
        if (response.ok) {
          const { hasNewRides, newRidesCount } = await response.json();
          console.log('Check result:', { hasNewRides, newRidesCount });
          
          if (hasNewRides && newRidesCount > 0) {
            toast.info(`🚗 ${newRidesCount} new ride request(s) awaiting your approval!`, {
              action: {
                label: 'View Now',
                onClick: () => {
                  setActiveTab('pending');
                  fetchAllRides();
                }
              },
              duration: 10000, // Show for 10 seconds
            });
            
            // Send WhatsApp notification to PM
            sendWhatsAppNotification('new_request', newRidesCount);
            
            // Refresh rides data
            fetchAllRides();
          }
        } else {
          console.error('Failed to check for new rides:', response.status);
        }
      } catch (error) {
        console.log('Error checking for new rides:', error);
      }
    }, 30000); // Check every 30 seconds
  };

  const sendWhatsAppNotification = async (type: string, data?: any) => {
    try {
      console.log('Sending WhatsApp notification:', { type, data });
      const response = await fetch('/api/notifications/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          data,
          phoneNumber: '+94750569545' // PM's WhatsApp number
        })
      });
      
      if (response.ok) {
        console.log('WhatsApp notification sent successfully');
      } else {
        console.error('Failed to send WhatsApp notification:', response.status);
      }
    } catch (error) {
      console.error('Failed to send WhatsApp notification:', error);
    }
  };

  const sendUserNotification = async (userId: string, rideId: string, status: string) => {
    try {
      console.log('Sending user notification:', { userId, rideId, status });
      const response = await fetch('/api/notifications/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          rideId,
          status,
          message: status === 'approved' 
            ? 'Your ride request has been approved! Driver assignment will follow shortly.'
            : 'Your ride request has been rejected. Please contact support for more information.'
        })
      });
      
      if (response.ok) {
        console.log('User notification sent successfully');
      } else {
        console.error('Failed to send user notification:', response.status);
      }
    } catch (error) {
      console.error('Failed to send user notification:', error);
    }
  };

  const approveRide = async (rideId: string) => {
    try {
      console.log('Approving ride:', rideId);
      const response = await fetch(`/api/rides/${rideId}/approve`, {
        method: 'POST',
      });

      if (response.ok) {
        const ride = allRides.find(r => r._id === rideId);
        if (ride) {
          // Send notification to user
          await sendUserNotification(ride.userId, rideId, 'approved');
        }
        
        toast.success('✅ Ride approved successfully! User has been notified.');
        await fetchAllRides(); // Refresh data
      } else {
        const error = await response.json();
        toast.error(`Failed to approve ride: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to approve ride:', error);
      toast.error('Failed to approve ride. Please try again.');
    }
  };

  const rejectRide = async (rideId: string) => {
    try {
      console.log('Rejecting ride:', rideId);
      const response = await fetch(`/api/rides/${rideId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: 'Rejected by Project Manager'
        })
      });

      if (response.ok) {
        const ride = allRides.find(r => r._id === rideId);
        if (ride) {
          // Send notification to user
          await sendUserNotification(ride.userId, rideId, 'rejected');
        }
        
        toast.success('❌ Ride rejected. User has been notified.');
        await fetchAllRides(); // Refresh data
      } else {
        const error = await response.json();
        toast.error(`Failed to reject ride: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to reject ride:', error);
      toast.error('Failed to reject ride. Please try again.');
    }
  };

  const openRideMap = (ride: Ride) => {
    setSelectedRideForMap(ride);
    setIsMapDialogOpen(true);
  };

  // Filter rides based on status
  const pendingRides = allRides.filter(ride => ride.status === 'awaiting_pm');
  const approvedRides = allRides.filter(ride => 
    ['approved', 'in_progress', 'completed'].includes(ride.status) && ride.distanceKm > 25
  ).sort((a, b) => new Date(b.approvedAt || b.createdAt).getTime() - new Date(a.approvedAt || a.createdAt).getTime());

  console.log('Current data:', {
    allRides: allRides.length,
    pendingRides: pendingRides.length,
    approvedRides: approvedRides.length,
    activeTab
  });

  // Map Dialog Component
  const RideMapDialog = () => {
    if (!selectedRideForMap) return null;

    const ride = selectedRideForMap;
    const mapDevices = [];
    
    if (ride.startLocation.latitude && ride.startLocation.longitude) {
      mapDevices.push({
        _id: `start-${ride._id}`,
        terminalId: 'PICKUP',
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
        terminalId: 'DESTINATION',
        vehicle: 'Destination',
        vehicleType: 'location',
        status: 'destination',
        latitude: ride.endLocation.latitude.toString(),
        longitude: ride.endLocation.longitude.toString(),
        speed: 0,
        lastMessage: new Date().toISOString(),
        expire: '',
        address: ride.endLocation.address
      });
    }

    return (
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Navigation className="w-6 h-6 text-orange-600" />
            Ride Route - Trip #{ride._id.slice(-6)}
          </DialogTitle>
          <DialogDescription>
            Review pickup and destination locations for approval decision
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <Card>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                    <User className="w-5 h-5" />
                    Trip Information
                  </h4>
                  <div className="space-y-3">
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <p className="text-sm font-medium text-gray-600">Requester</p>
                      <p className="font-semibold text-gray-900">{ride.userName || 'Unknown User'}</p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm font-medium text-gray-600">Distance</p>
                      <p className="font-semibold text-gray-900">{ride.distanceKm.toFixed(1)} km</p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm font-medium text-gray-600">Requested On</p>
                      <p className="font-semibold text-gray-900">{new Date(ride.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                    <MapPin className="w-5 h-5" />
                    Route Details
                  </h4>
                  <div className="space-y-3">
                    <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                      <div className="flex items-center gap-2 mb-2">
                        <MapPin className="w-4 h-4 text-green-600" />
                        <span className="text-sm font-medium text-green-800">Pickup Location</span>
                      </div>
                      <p className="text-sm text-gray-700">{ride.startLocation.address}</p>
                    </div>
                    
                    <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                      <div className="flex items-center gap-2 mb-2">
                        <MapPin className="w-4 h-4 text-red-600" />
                        <span className="text-sm font-medium text-red-800">Destination</span>
                      </div>
                      <p className="text-sm text-gray-700">{ride.endLocation.address}</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Map className="w-5 h-5" />
                Route Map
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="w-full h-96 rounded-lg overflow-hidden border">
                {mapDevices.length > 0 ? (
                  <GoogleMap 
                    devices={mapDevices as any} 
                    onDeviceSelect={() => {}}
                    height="100%" 
                  />
                ) : (
                  <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                    <div className="text-center">
                      <MapPin className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">Location coordinates not available</p>
                    </div>
                  </div>
                )}
              </div>
              {mapDevices.length > 0 && (
                <div className="mt-4 flex items-center justify-center gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span>Pickup Location</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <span>Destination</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-3 pt-4 border-t">
            <Button
              onClick={() => {
                approveRide(ride._id);
                setIsMapDialogOpen(false);
              }}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
            >
              <Check className="w-4 h-4" />
              Approve Ride
            </Button>
            <Button
              onClick={() => {
                rejectRide(ride._id);
                setIsMapDialogOpen(false);
              }}
              variant="outline"
              className="flex items-center gap-2 text-red-600 border-red-600 hover:bg-red-50"
            >
              <X className="w-4 h-4" />
              Reject Ride
            </Button>
            <Button
              variant="ghost"
              onClick={() => setIsMapDialogOpen(false)}
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Project Manager Dashboard</h1>
            <p className="text-gray-600 mt-1">Manage long-distance ride approvals and monitor approved rides</p>
          </div>
          <div className="flex items-center gap-4">
            <Button
              onClick={fetchAllRides}
              variant="outline"
              size="sm"
            >
              🔄 Refresh
            </Button>
            <Badge variant="outline" className="text-lg px-4 py-2 bg-orange-50 border-orange-200">
              <Bell className="w-4 h-4 mr-2" />
              {pendingRides.length} Pending Approvals
            </Badge>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b bg-white rounded-lg p-1">
          <div className="flex space-x-1">
            <button
              onClick={() => setActiveTab('pending')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === 'pending'
                  ? 'bg-orange-100 text-orange-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              <AlertCircle className="w-4 h-4" />
              Pending Approvals ({pendingRides.length})
            </button>
            <button
              onClick={() => setActiveTab('approved')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === 'approved'
                  ? 'bg-green-100 text-green-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              <CheckCircle className="w-4 h-4" />
              Recent Approved ({approvedRides.length})
            </button>
          </div>
        </div>

        {/* Pending Approvals Tab */}
        {activeTab === 'pending' && (
          <>
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <div className="text-lg">Loading rides...</div>
              </div>
            ) : pendingRides.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Check className="w-16 h-16 text-green-400 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-600 mb-2">All caught up!</h3>
                  <p className="text-gray-500">No rides pending your approval at the moment.</p>
                  <Button 
                    onClick={fetchAllRides}
                    variant="outline"
                    className="mt-4"
                  >
                    🔄 Check Again
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6">
                {pendingRides.map((ride) => (
                  <Card 
                    key={ride._id} 
                    className="border-l-4 border-l-orange-500 cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => openRideMap(ride)}
                  >
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 text-orange-600" />
                            Ride #{ride._id.slice(-6)} - Approval Required
                            <Eye className="w-4 h-4 text-blue-600 ml-2" />
                          </CardTitle>
                          <CardDescription>
                            Long distance ride ({ride.distanceKm.toFixed(1)} km) - Requested on {new Date(ride.createdAt).toLocaleDateString()}
                          </CardDescription>
                        </div>
                        <Badge className="bg-orange-100 text-orange-800 animate-pulse">
                          <Bell className="w-3 h-3 mr-1" />
                          Awaiting PM Approval
                        </Badge>
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
                            <div className="p-4 bg-yellow-50 rounded-lg">
                              <div className="flex items-center gap-2 mb-2">
                                <AlertCircle className="w-4 h-4 text-yellow-600" />
                                <span className="font-medium text-yellow-800">Long Distance Alert</span>
                              </div>
                              <p className="text-sm text-yellow-700">
                                This ride is {ride.distanceKm.toFixed(1)} km, which exceeds the 25 km threshold and requires PM approval.
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-blue-600" />
                              <span className="text-sm text-gray-600">
                                Requester: <span className="font-medium text-blue-600">{ride.userName || 'Unknown User'}</span>
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-3 pt-4 border-t">
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              approveRide(ride._id);
                            }}
                            className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                          >
                            <Check className="w-4 h-4" />
                            Approve & Notify User
                          </Button>
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              rejectRide(ride._id);
                            }}
                            variant="outline"
                            className="flex items-center gap-2 text-red-600 border-red-600 hover:bg-red-50"
                          >
                            <X className="w-4 h-4" />
                            Reject & Notify User
                          </Button>
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              openRideMap(ride);
                            }}
                            variant="ghost"
                            className="flex items-center gap-2 text-blue-600 hover:bg-blue-50"
                          >
                            <Eye className="w-4 h-4" />
                            View Map
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}

        {/* Recent Approved Tab */}
        {activeTab === 'approved' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                Recently Approved Long-Distance Rides
              </CardTitle>
              <CardDescription>
                Long-distance rides you have approved, showing current status and progress
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center items-center h-32">
                  <div className="text-lg">Loading approved rides...</div>
                </div>
              ) : approvedRides.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No approved rides yet</h3>
                  <p className="text-gray-500">Long-distance rides you approve will appear here with their current status.</p>
                  <Button 
                    onClick={fetchAllRides}
                    variant="outline"
                    className="mt-4"
                  >
                    🔄 Refresh Data
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {approvedRides.slice(0, 10).map((ride) => {
                    const getStatusColor = (status: string) => {
                      switch (status) {
                        case 'approved': return 'bg-blue-100 text-blue-800';
                        case 'in_progress': return 'bg-purple-100 text-purple-800';
                        case 'completed': return 'bg-green-100 text-green-800';
                        default: return 'bg-gray-100 text-gray-800';
                      }
                    };

                    return (
                      <div key={ride._id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <div className="flex items-center gap-3 mb-2">
                              <h4 className="font-medium">Ride #{ride._id.slice(-6)}</h4>
                              <Badge className={getStatusColor(ride.status)}>
                                {ride.status.replace('_', ' ')}
                              </Badge>
                              <Badge variant="outline" className="text-orange-600 border-orange-600">
                                {ride.distanceKm.toFixed(1)} km
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-600">
                              Approved for: <span className="font-medium">{ride.userName || 'Unknown User'}</span>
                            </p>
                            <p className="text-sm text-gray-600">
                              Approved on {ride.approvedAt ? new Date(ride.approvedAt).toLocaleDateString() : new Date(ride.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="grid md:grid-cols-2 gap-3">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-green-600" />
                            <span className="text-sm truncate">{ride.startLocation.address}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-red-600" />
                            <span className="text-sm truncate">{ride.endLocation.address}</span>
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

        {/* Statistics */}
        <div className="grid md:grid-cols-4 gap-6 mt-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Total Rides Today</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {allRides.filter(ride => 
                  new Date(ride.createdAt).toDateString() === new Date().toDateString()
                ).length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Long Distance Rides</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {allRides.filter(ride => ride.distanceKm > 25).length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Pending Approvals</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {pendingRides.length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Approved Today</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {allRides.filter(ride => 
                  ['approved', 'in_progress', 'completed'].includes(ride.status) && 
                  ride.approvedAt && 
                  new Date(ride.approvedAt).toDateString() === new Date().toDateString()
                ).length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Map Dialog */}
        <Dialog open={isMapDialogOpen} onOpenChange={setIsMapDialogOpen}>
          <RideMapDialog />
        </Dialog>
      </div>
    </DashboardLayout>
  );
}