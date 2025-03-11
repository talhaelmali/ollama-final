import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const response = await fetch('http://backend-service:3001/api/testchat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body)
    });
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error calling backend test chat service:', error);
    return NextResponse.json(
      { error: 'Failed to get test chat response' },
      { status: 500 }
    );
  }
} 