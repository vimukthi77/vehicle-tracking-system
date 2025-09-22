// app/api/rides/[id]/approve/route.ts
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
    
    await connectDB();
    
    const { id } = params;
    
    if (!id) {
      return NextResponse.json({ error: 'Ride ID is required' }, { status: 400 });
    }
    
    const ride = await RideModel.findById(id);
    if (!ride) {
      return NextResponse.json({ error: 'Ride not found' }, { status: 404 });
    }
    
    console.log('Approving ride:', id, 'User role:', decoded.role, 'Ride status:', ride.status);
    
    if (decoded.role === 'project_manager' && ride.status === 'awaiting_pm') {
      ride.approval = ride.approval || {};
      ride.approval.projectManager = {
        approved: true,
        approvedAt: new Date(),
        approvedBy: decoded.userId
      };
      ride.status = 'awaiting_admin';
    } else if (decoded.role === 'admin' && ride.status === 'awaiting_admin') {
      ride.approval = ride.approval || {};
      ride.approval.admin = {
        approved: true,
        approvedAt: new Date(),
        approvedBy: decoded.userId
      };
      ride.status = 'approved';
    } else {
      return NextResponse.json({ 
        error: `Cannot approve this ride. Role: ${decoded.role}, Status: ${ride.status}` 
      }, { status: 400 });
    }
    
    await ride.save();
    
    console.log('Ride approved successfully:', ride._id, 'New status:', ride.status);
    
    return NextResponse.json(ride);
  } catch (error) {
    console.error('Approve ride error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}