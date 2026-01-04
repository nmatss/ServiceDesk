#!/usr/bin/env node
/**
 * Custom Server with Socket.io Integration
 *
 * This server wraps Next.js with Socket.io for real-time features:
 * - Live ticket updates
 * - Real-time notifications
 * - User presence tracking
 * - Chat and collaboration
 * - HTTP compression (gzip/brotli)
 */

import { createServer } from 'http'
import { parse } from 'url'
import next from 'next'
import { Server as SocketIOServer } from 'socket.io'
import compression from 'compression'
import { initializeRealtimeEngine } from './lib/notifications/realtime-engine'

const dev = process.env.NODE_ENV !== 'production'
const hostname = process.env.HOSTNAME || 'localhost'
const port = parseInt(process.env.PORT || '3000', 10)

// Initialize Next.js app
const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  // Initialize compression middleware
  const compress = compression({
    threshold: 1024, // Only compress responses > 1KB
    level: 6, // Compression level (0-9, 6 is optimal balance)
    filter: (req, res) => {
      // Don't compress if client explicitly requests no compression
      if (req.headers['x-no-compression']) {
        return false
      }
      // Use compression's default filter (checks Content-Type)
      return compression.filter(req, res)
    },
  })

  // Create HTTP server with compression
  const server = createServer(async (req, res) => {
    try {
      // Apply compression middleware
      // @ts-ignore - compression expects Express types but works with native http
      compress(req, res, async () => {
        const parsedUrl = parse(req.url!, true)
        await handle(req, res, parsedUrl)
      })
    } catch (err) {
      console.error('Error handling request:', err)
      res.statusCode = 500
      res.end('Internal server error')
    }
  })

  // Initialize Socket.io
  const io = new SocketIOServer(server, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true
    },
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000
  })

  // Initialize real-time notification engine (graceful degradation if tables missing)
  try {
    initializeRealtimeEngine(server)
    console.log('✅ Socket.io initialized with real-time engine')
  } catch (error) {
    console.warn('⚠️  Socket.io initialized without real-time features (database tables missing)')
    console.warn('   Run migrations to enable notifications: npm run init-db')
  }

  console.log(`📡 WebSocket endpoint: ws://${hostname}:${port}/socket.io`)

  // Start server
  server.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`)
    console.log(`> Environment: ${process.env.NODE_ENV}`)
    console.log(`> Compression: ${dev ? 'gzip (dev)' : 'gzip/brotli (production)'}`)
  })

  // Graceful shutdown
  const shutdown = () => {
    console.log('\n🛑 Shutting down server...')

    io.close(() => {
      console.log('✅ Socket.io connections closed')
    })

    server.close(() => {
      console.log('✅ HTTP server closed')
      process.exit(0)
    })

    // Force exit after 10 seconds
    setTimeout(() => {
      console.error('❌ Forced shutdown after timeout')
      process.exit(1)
    }, 10000)
  }

  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
})
