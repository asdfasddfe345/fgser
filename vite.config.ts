import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Simple API middleware for development
function apiMiddleware() {
  return {
    name: 'api-middleware',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        // Only handle /api/* routes
        if (!req.url.startsWith('/api/')) {
          return next();
        }

        // Parse body for POST requests
        if (req.method === 'POST') {
          let body = '';
          req.on('data', (chunk: any) => {
            body += chunk.toString();
          });
          req.on('end', async () => {
            try {
              req.body = JSON.parse(body);
            } catch (e) {
              req.body = {};
            }
            await handleApiRequest(req, res);
          });
        } else {
          await handleApiRequest(req, res);
        }
      });
    }
  };
}

async function handleApiRequest(req: any, res: any) {
  const url = req.url;

  // Route to appropriate handler
  if (url === '/api/ai-enrich' || url.startsWith('/api/ai-enrich?')) {
    const { handleAiEnrich } = await import('./src/api/ai-enrich');
    return handleAiEnrich(req, res);
  }

  if (url === '/api/ai-health' || url.startsWith('/api/ai-health?')) {
    const { handleAiHealth } = await import('./src/api/ai-health');
    return handleAiHealth(req, res);
  }

  // 404 for unknown routes
  res.statusCode = 404;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ error: 'Not Found' }));
}

export default defineConfig({
  plugins: [
    react(),
    apiMiddleware(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
});
