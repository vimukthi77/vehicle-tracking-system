import { NextRequest, NextResponse } from 'next/server';
import  connectDB  from '@/lib/mongodb';
import { RideModel } from '@/lib/models';
import { verifyToken } from '@/lib/auth';

export async function PATCH(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value;
    const decoded = verifyToken(token!) as any;
    
    await connectDB();
    
    // Get ID from URL search params
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'Ride ID is required' }, { status: 400 });
    }
    
    const { status } = await request.json();
    
    const ride = await RideModel.findById(id);
    if (!ride) {
      return NextResponse.json({ error: 'Ride not found' }, { status: 404 });
    }
    
    // Only drivers can update status of their assigned rides
    if (decoded.role === 'driver' && ride.driverId !== decoded.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    
    // Only allow valid status transitions
    const validStatuses = ['in_progress', 'completed'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }
    
    ride.status = status;
    await ride.save();
    
    return NextResponse.json(ride);
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}