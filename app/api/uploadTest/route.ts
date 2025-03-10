import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const response = await fetch('http://backend-service:3001/uploadTest');
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error testing backend:', error);
    return NextResponse.json(
      { error: 'Failed to connect to backend service' },
      { status: 500 }
    );
  }
}