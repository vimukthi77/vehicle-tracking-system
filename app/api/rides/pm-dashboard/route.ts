// app/api/rides/pm-dashboard/route.ts
import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { RideModel } from '@/lib/models';
import { verifyToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401 });
    }

    const decoded = verifyToken(token) as any;
    
    if (decoded.role !== 'project_manager') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    
    await connectDB();
    
    // Get all long-distance rides (>25km) for PM dashboard
    const rides = await RideModel.find({
      distanceKm: { $gt: 25 }
    }).sort({ createdAt: -1 });
    
    console.log(`PM Dashboard: Found ${rides.length} long-distance rides`);
    
    return NextResponse.json(rides);
  } catch (error) {
    console.error('GET /api/rides/pm-dashboard error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}