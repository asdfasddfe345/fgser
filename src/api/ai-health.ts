import type { Request, Response } from 'express';

export function handleAiHealth(req: Request, res: Response) {
  const apiKey = import.meta.env.VITE_AGENTROUTER_API_KEY;
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  res.status(200).json({
    status: 'ok',
    environment: 'development',
    agentRouterConfigured: !!apiKey,
    timestamp: new Date().toISOString(),
  });
}
