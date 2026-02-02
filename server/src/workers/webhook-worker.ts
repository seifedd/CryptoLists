import { processWebhookQueue } from '../services/webhook-processor.service.js';
import prisma from '../prisma.js';

const POLL_INTERVAL_MS = 5000; // 5 seconds
let isRunning = false;

/**
 * Background worker to process webhook queue.
 * Runs in a separate process or can be started alongside the main server.
 */
async function startWorker(): Promise<void> {
    console.log('🔄 Starting webhook worker...');
    console.log(`   Poll interval: ${POLL_INTERVAL_MS}ms`);

    isRunning = true;

    // Graceful shutdown handlers
    process.on('SIGTERM', () => {
        console.log('Received SIGTERM, shutting down worker...');
        isRunning = false;
    });

    process.on('SIGINT', () => {
        console.log('Received SIGINT, shutting down worker...');
        isRunning = false;
    });

    while (isRunning) {
        try {
            await processWebhookQueue();
        } catch (error) {
            console.error('Worker error:', error);
            // Continue processing despite errors
        }

        await sleep(POLL_INTERVAL_MS);
    }

    // Cleanup
    await prisma.$disconnect();
    console.log('Worker shut down gracefully');
    process.exit(0);
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Start worker
startWorker().catch(error => {
    console.error('Fatal worker error:', error);
    process.exit(1);
});
