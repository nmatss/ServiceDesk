import { NextResponse } from 'next/server'

/**
 * Swagger UI HTML Page
 *
 * Serves interactive API documentation using Swagger UI.
 * Accessible at /api/docs
 */
export async function GET() {
  const html = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="ServiceDesk API Documentation" />
    <title>ServiceDesk API Documentation</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css" />
    <style>
      body {
        margin: 0;
        padding: 0;
      }
      .topbar {
        display: none;
      }
      .swagger-ui .info {
        margin: 20px 0;
      }
      .swagger-ui .info .title {
        font-size: 36px;
        color: #3B82F6;
      }
      .swagger-ui .scheme-container {
        background: #f8f9fa;
        padding: 20px;
        border-radius: 8px;
        margin: 20px 0;
      }
      .custom-header {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 20px 40px;
        margin: 0;
      }
      .custom-header h1 {
        margin: 0;
        font-size: 28px;
        font-weight: 600;
      }
      .custom-header p {
        margin: 10px 0 0 0;
        opacity: 0.9;
        font-size: 14px;
      }
    </style>
  </head>
  <body>
    <div class="custom-header">
      <h1>🎫 ServiceDesk API Documentation</h1>
      <p>Enterprise Service Desk Platform - RESTful API v1.0.0</p>
    </div>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js" crossorigin></script>
    <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-standalone-preset.js" crossorigin></script>
    <script>
      window.onload = () => {
        window.ui = SwaggerUIBundle({
          url: '/api/docs/openapi.yaml',
          dom_id: '#swagger-ui',
          deepLinking: true,
          presets: [
            SwaggerUIBundle.presets.apis,
            SwaggerUIStandalonePreset
          ],
          plugins: [
            SwaggerUIBundle.plugins.DownloadUrl
          ],
          layout: "StandaloneLayout",
          tryItOutEnabled: true,
          requestInterceptor: (request) => {
            // Add CSRF token to requests if available
            const csrfToken = document.cookie
              .split('; ')
              .find(row => row.startsWith('csrf_token='))
              ?.split('=')[1];

            if (csrfToken) {
              request.headers['x-csrf-token'] = csrfToken;
            }

            return request;
          },
          onComplete: () => {
            console.log('Swagger UI loaded successfully');
          },
          validatorUrl: null, // Disable validator badge
          docExpansion: 'list',
          filter: true,
          syntaxHighlight: {
            activate: true,
            theme: 'monokai'
          },
          persistAuthorization: true,
          displayRequestDuration: true,
          defaultModelsExpandDepth: 3,
          defaultModelExpandDepth: 3,
          showExtensions: true,
          showCommonExtensions: true,
        });
      };
    </script>
  </body>
</html>
  `

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html',
      'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
    },
  })
}
