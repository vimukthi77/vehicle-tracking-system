// app/api/rides/[id]/assign-driver/route.ts
import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { RideModel } from '@/lib/models';
import { verifyToken } from '@/lib/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.cookies.get('token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401 });
    }
    
    const decoded = verifyToken(token) as any;

    if (decoded.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 });
    }

    await connectDB();

    const { driverId } = await request.json();
    const { id } = params;

    if (!id) {
      return NextResponse.json({ error: 'Ride ID is required' }, { status: 400 });
    }

    if (!driverId) {
      return NextResponse.json({ error: 'Driver ID is required' }, { status: 400 });
    }

    console.log('Assigning driver:', driverId, 'to ride:', id);

    const ride = await RideModel.findById(id);
    if (!ride) {
      return NextResponse.json({ error: 'Ride not found' }, { status: 404 });
    }

    if (ride.status !== 'approved') {
      return NextResponse.json({ 
        error: `Ride must be approved first. Current status: ${ride.status}` 
      }, { status: 400 });
    }

    ride.driverId = driverId;
    ride.status = 'in_progress'; // Update status when driver is assigned
    ride.assignedAt = new Date();
    
    await ride.save();

    console.log('Driver assigned successfully:', ride._id, 'Driver:', driverId);

    return NextResponse.json(ride);
  } catch (error) {
    console.error('Assign driver error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}