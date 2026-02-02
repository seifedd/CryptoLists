import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { captureRawBody } from './middleware/shopify-webhook-verifier.js';
import productsRoutes from './routes/products.routes.js';
import checkoutRoutes from './routes/checkout.routes.js';
import webhooksRoutes from './routes/webhooks.routes.js';
import prisma from './prisma.js';

const app = express();
const PORT = process.env.PORT || 3001;

// ==============================================
// MIDDLEWARE
// ==============================================

// CORS - allow frontend access
app.use(cors({
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Parse JSON with raw body capture for webhook verification
app.use(express.json({
    verify: captureRawBody,
    limit: '10mb'
}));

// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true }));

// ==============================================
// ROUTES
// ==============================================

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// API Routes
app.use('/api/products', productsRoutes);
app.use('/api/checkout', checkoutRoutes);
app.use('/webhooks/shopify', webhooksRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// ==============================================
// SERVER STARTUP
// ==============================================

async function startServer(): Promise<void> {
    try {
        // Test database connection
        await prisma.$connect();
        console.log('✅ Database connected');

        // Start server
        app.listen(PORT, () => {
            console.log(`
╔════════════════════════════════════════════════════╗
║     🛒 E-Commerce Server Started Successfully!     ║
╠════════════════════════════════════════════════════╣
║  Server:    http://localhost:${PORT}                  ║
║  Health:    http://localhost:${PORT}/health           ║
║  Products:  http://localhost:${PORT}/api/products     ║
║  Checkout:  http://localhost:${PORT}/api/checkout     ║
║  Webhooks:  http://localhost:${PORT}/webhooks/shopify ║
╚════════════════════════════════════════════════════╝
      `);
        });

    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('Received SIGTERM, shutting down...');
    await prisma.$disconnect();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('Received SIGINT, shutting down...');
    await prisma.$disconnect();
    process.exit(0);
});

startServer();

export default app;
