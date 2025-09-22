// app/api/notifications/user/route.ts
import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { UserModel } from '@/lib/models';
import { verifyToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401 });
    }

    const decoded = verifyToken(token) as any;
    
    if (decoded.role !== 'project_manager' && decoded.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { userId, rideId, status, message } = await request.json();
    
    if (!userId || !rideId || !status || !message) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }

    await connectDB();
    
    // Find the user to get their details
    const user = await UserModel.findById(userId);
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Log the notification (in production, you'd send email/SMS/push notification)
    console.log(`User Notification:`);
    console.log(`To: ${user.name} (${user.email})`);
    console.log(`Ride ID: ${rideId}`);
    console.log(`Status: ${status}`);
    console.log(`Message: ${message}`);
    console.log(`Time: ${new Date().toLocaleString()}`);
    console.log('---');

    // Here you can implement various notification methods:
    
    // 1. Email notification (using nodemailer, sendgrid, etc.)
    /*
    await sendEmail({
      to: user.email,
      subject: `Ride Update - ${status}`,
      html: `
        <h2>Ride Status Update</h2>
        <p>Dear ${user.name},</p>
        <p>${message}</p>
        <p>Ride ID: ${rideId}</p>
        <p>Status: ${status}</p>
        <p>Thank you for using our service.</p>
      `
    });
    */

    // 2. SMS notification (using Twilio, etc.)
    /*
    if (user.phone) {
      await sendSMS({
        to: user.phone,
        message: `Ride Update: ${message} - Ride ID: ${rideId.slice(-6)}`
      });
    }
    */

    // 3. Push notification (using Firebase, etc.)
    /*
    if (user.fcmToken) {
      await sendPushNotification({
        token: user.fcmToken,
        title: 'Ride Status Update',
        body: message,
        data: { rideId, status }
      });
    }
    */

    // 4. In-app notification (store in database)
    /*
    await NotificationModel.create({
      userId,
      rideId,
      type: 'ride_status_update',
      title: 'Ride Status Update',
      message,
      status: 'unread',
      createdAt: new Date()
    });
    */

    return NextResponse.json({ 
      success: true, 
      message: 'User notification sent successfully',
      recipient: user.email,
      notificationType: status
    });
  } catch (error) {
    console.error('POST /api/notifications/user error:', error);
    return NextResponse.json({ 
      error: 'Failed to send user notification',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    }, { status: 500 });
  }
}