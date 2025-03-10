'use client';

import { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ServicePort {
  port: number;
  targetPort: number | string;
  protocol: string;
}

interface K8sService {
  name: string;
  namespace: string;
  type: string;
  clusterIP: string;
  ports: ServicePort[];
  externalUrls: string[];
}

interface K8sResponse {
  services: K8sService[];
  count: number;
  error?: string;
}

export default function Home() {
  const [data, setData] = useState<K8sResponse>({ services: [], count: 0 });
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [serverResponse, setServerResponse] = useState<string>('');
  const [testLoading, setTestLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  useEffect(() => {
    const fetchServices = async () => {
      try {
        const response = await fetch('/api/k8s/services');
        const result: K8sResponse = await response.json();
        
        if (result.error) {
          setError(result.error);
        } else {
          setData(result);
        }
      } catch (err) {
        setError('Failed to fetch Kubernetes services');
        console.error('Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchServices();
  }, []);

  const testServer = async () => {
    setTestLoading(true);
    setServerResponse('');
    try {
      const response = await fetch('/api/test');
      const result = await response.json();
      setServerResponse(JSON.stringify(result, null, 2));
    } catch (err) {
      setServerResponse('Failed to connect to the server: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setTestLoading(false);
    }
  };

  const handleChat = async () => {
    if (!message.trim()) return;
    
    setChatLoading(true);
    setAiResponse('');
    
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message })
      });
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      setAiResponse(data.response);
    } catch (err) {
      setAiResponse('Error: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setChatLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-primary">Loading services...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-destructive/10 p-4 rounded-md mb-4">
            <p className="text-destructive">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-card-foreground">
            Kubernetes Services ({data.count})
          </h1>
          <Button 
            onClick={testServer}
            disabled={testLoading}
          >
            {testLoading ? 'Testing...' : 'Test Server'}
          </Button>
        </div>

        {/* Chat Interface */}
        <div className="bg-card p-6 rounded-lg shadow-lg mb-8">
          <h2 className="text-xl font-semibold text-card-foreground mb-4">AI Chat</h2>
          <div className="space-y-4">
            <Textarea
              placeholder="Type your message here..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full min-h-[100px]"
            />
            <Button
              onClick={handleChat}
              disabled={chatLoading || !message.trim()}
              className="w-full"
            >
              {chatLoading ? 'Getting Response...' : 'Send Message'}
            </Button>
            {aiResponse && (
              <div className="bg-muted p-4 rounded-md">
                <h3 className="font-medium mb-2">AI Response:</h3>
                <p className="whitespace-pre-wrap">{aiResponse}</p>
              </div>
            )}
          </div>
        </div>

        {serverResponse && (
          <div className="bg-card p-4 rounded-lg shadow-lg mb-6">
            <h2 className="text-xl font-semibold text-card-foreground mb-2">Server Response:</h2>
            <pre className="bg-muted p-4 rounded-md overflow-x-auto">
              {serverResponse}
            </pre>
          </div>
        )}
        
        <div className="grid gap-6">
          {data.services.map((service) => (
            <div key={`${service.namespace}-${service.name}`} className="bg-card p-6 rounded-lg shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-card-foreground">
                  {service.name}
                </h2>
                <span className="px-3 py-1 bg-primary/10 rounded-full text-sm text-primary">
                  {service.type}
                </span>
              </div>
              
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>Namespace: {service.namespace}</p>
                <p>Cluster IP: {service.clusterIP}</p>
                
                <div>
                  <p className="font-medium text-card-foreground">Ports:</p>
                  <ul className="ml-4 space-y-1">
                    {service.ports.map((port, idx) => (
                      <li key={idx}>
                        {port.port} → {port.targetPort} ({port.protocol})
                      </li>
                    ))}
                  </ul>
                </div>

                {service.externalUrls.length > 0 && (
                  <div>
                    <p className="font-medium text-card-foreground">External URLs:</p>
                    <ul className="ml-4 space-y-1">
                      {service.externalUrls.map((url, idx) => (
                        <li key={idx}>{url}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}