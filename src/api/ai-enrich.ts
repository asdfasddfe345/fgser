import type { Request, Response } from 'express';

const AGENTROUTER_API_KEY = import.meta.env.VITE_AGENTROUTER_API_KEY || '';
const AGENTROUTER_API_URL = 'https://api.agentrouter.ai/v1/chat/completions';

interface AIRequest {
  model?: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  max_tokens?: number;
}

export async function handleAiEnrich(req: Request, res: Response) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  // Only allow POST
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Check API key
  if (!AGENTROUTER_API_KEY) {
    console.error('VITE_AGENTROUTER_API_KEY not configured');
    res.status(500).json({ error: 'Server configuration error - API key missing' });
    return;
  }

  try {
    const body: AIRequest = req.body;
    const { model = 'gpt-4o', messages, temperature = 0.7, max_tokens = 2000 } = body;

    if (!messages || !Array.isArray(messages)) {
      res.status(400).json({ error: 'Invalid request: messages array required' });
      return;
    }

    console.log(`[DEV] AI Request: model=${model}, messages=${messages.length}`);

    // Create timeout controller
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(AGENTROUTER_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AGENTROUTER_API_KEY}`,
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages,
          temperature,
          max_tokens,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const data = await response.json();

      if (!response.ok) {
        console.error('[DEV] AgentRouter error:', response.status, data);
        res.status(response.status).json({
          error: data.error?.message || 'AgentRouter API error',
          code: data.error?.code || response.status,
          details: data,
        });
        return;
      }

      console.log(`[DEV] AI Response: tokens=${data.usage?.total_tokens || 0}`);

      res.status(200).json(data);
    } catch (fetchError: any) {
      clearTimeout(timeout);
      
      if (fetchError.name === 'AbortError') {
        console.error('[DEV] Request timeout');
        res.status(504).json({ error: 'Request timeout after 30 seconds' });
        return;
      }

      throw fetchError;
    }
  } catch (error: any) {
    console.error('[DEV] API error:', error);
    res.status(502).json({
      error: 'Failed to process AI request',
      detail: error.message,
    });
  }
}
