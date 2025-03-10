import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const response = await fetch("http://backend-service:3001/uploadTest");
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error testing backend:", error);
    return NextResponse.json(
      { error: "Failed to connect to backend service" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    // Check if the request is a FormData request
    const contentType = request.headers.get('content-type') || '';
    
    if (contentType.includes('multipart/form-data')) {
      // Handle file upload
      const formData = await request.formData();
      const file = formData.get('file') as File;
      
      if (!file) {
        return NextResponse.json(
          { error: "No file provided" },
          { status: 400 }
        );
      }
      
      // Check if the file is a PDF
      if (file.type !== 'application/pdf') {
        return NextResponse.json(
          { error: "Only PDF files are allowed" },
          { status: 400 }
        );
      }
      
      // Create a new FormData to forward to the backend
      const backendFormData = new FormData();
      backendFormData.append('file', file);
      
      // Forward the file to the backend service
      const response = await fetch("http://backend-service:3001/api/uploadTest", {
        method: "POST",
        body: backendFormData,
      });
      
      const responseData = await response.json();
      return NextResponse.json(responseData);
    } else {
      // Handle JSON data for backward compatibility
      const data = await request.json();
      const response = await fetch("http://backend-service:3001/api/uploadTest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      
      const responseData = await response.json();
      return NextResponse.json(responseData);
    }
  } catch (error) {
    console.error("Error posting to backend:", error);
    return NextResponse.json(
      { error: "Failed to connect to backend service" },
      { status: 500 }
    );
  }
}
