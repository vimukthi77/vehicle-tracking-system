// app/api/rides/route.ts
import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { RideModel } from '@/lib/models';
import { verifyToken } from '@/lib/auth';
import { calculateHaversineDistance } from '@/lib/distance'; // Import the utility function

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401 });
    }

    const decoded = verifyToken(token) as any;
    
    await connectDB();
    
    let query = {};
    
    if (decoded.role === 'user') {
      query = { userId: decoded.userId };
    } else if (decoded.role === 'driver') {
      query = { driverId: decoded.userId };
    } else if (decoded.role === 'project_manager') {
      query = { status: 'awaiting_pm' };
    }
    // Admin can see all rides
    
    const rides = await RideModel.find(query).sort({ createdAt: -1 });
    
    return NextResponse.json(rides);
  } catch (error) {
    console.error('GET /api/rides error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401 });
    }

    const decoded = verifyToken(token) as any;
    
    if (decoded.role !== 'user') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    
    await connectDB();
    
    const { startLocation, endLocation, distanceKm: providedDistance } = await request.json();
    
    if (!startLocation || !endLocation) {
      return NextResponse.json({ error: 'Start and end locations are required' }, { status: 400 });
    }

    if (!startLocation.lat || !startLocation.lng || !endLocation.lat || !endLocation.lng) {
      return NextResponse.json({ error: 'Coordinates are required for both locations' }, { status: 400 });
    }
    
    // Use provided distance or calculate it as fallback
    let distanceKm = providedDistance;
    
    if (!distanceKm || typeof distanceKm !== 'number') {
      console.log('Calculating distance as fallback...');
      distanceKm = calculateHaversineDistance(
        startLocation.lat,
        startLocation.lng,
        endLocation.lat,
        endLocation.lng
      );
    }
    
    console.log('Final distance to save:', distanceKm);
    
    const ride = new RideModel({
      userId: decoded.userId,
      distanceKm,
      startLocation,
      endLocation,
      status: distanceKm > 25 ? 'awaiting_pm' : 'awaiting_admin',
      approval: {}
    });
    
    await ride.save();
    
    console.log('Saved ride with distance:', ride.distanceKm);
    
    return NextResponse.json(ride);
  } catch (error) {
    console.error('POST /api/rides error:', error);
    return NextResponse.json({ 
      error: 'Server error',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    }, { status: 500 });
  }
}