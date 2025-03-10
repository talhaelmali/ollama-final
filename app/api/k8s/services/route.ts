import { KubeConfig, CoreV1Api } from '@kubernetes/client-node';
import { NextResponse } from 'next/server';

// Disable static page generation for this route
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const kc = new KubeConfig();
    kc.loadFromDefault();

    // Set cluster config for in-cluster operation
    if (process.env.KUBERNETES_SERVICE_HOST) {
      kc.loadFromCluster();
    }
    
    const k8sApi = kc.makeApiClient(CoreV1Api);
    
    const response = await k8sApi.listServiceForAllNamespaces();
    
    const services = response.body.items.map(service => ({
      name: service.metadata?.name,
      namespace: service.metadata?.namespace,
      type: service.spec?.type,
      clusterIP: service.spec?.clusterIP,
      ports: service.spec?.ports?.map(port => ({
        port: port.port,
        targetPort: port.targetPort,
        protocol: port.protocol
      })) || [],
      externalUrls: service.status?.loadBalancer?.ingress?.map(ingress => 
        ingress.hostname || ingress.ip
      ) || []
    }));

    return NextResponse.json({
      services,
      count: services.length
    });
    
  } catch (error) {
    console.error('Error fetching K8s services:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch Kubernetes services',
        services: [],
        count: 0
      },
      { status: 500 }
    );
  }
}

