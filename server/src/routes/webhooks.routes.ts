import { Router, Request, Response } from 'express';
import { verifyShopifyWebhook } from '../middleware/shopify-webhook-verifier.js';
import { receiveWebhook, getDeadLetterQueue, retryDeadLetterWebhook } from '../services/webhook-processor.service.js';
import { withIdempotency } from '../services/idempotency.service.js';

const router = Router();

/**
 * POST /webhooks/shopify/:topic
 * Generic Shopify webhook handler
 * Verifies HMAC, stores event, responds 200, processes async
 */
router.post('/:topic', verifyShopifyWebhook, async (req: Request, res: Response) => {
    try {
        const topic = req.params.topic.replace('-', '/'); // orders-paid → orders/paid
        const shopifyWebhookId = req.get('X-Shopify-Webhook-Id') || `manual-${Date.now()}`;
        const shopDomain = req.get('X-Shopify-Shop-Domain') || 'unknown';

        // Use idempotency to handle duplicate webhook deliveries
        const { isNew } = await withIdempotency(
            `webhook:${shopifyWebhookId}`,
            async () => {
                await receiveWebhook(
                    shopifyWebhookId,
                    topic,
                    shopDomain,
                    req.body,
                    {
                        'X-Shopify-Webhook-Id': shopifyWebhookId,
                        'X-Shopify-Shop-Domain': shopDomain,
                        'X-Shopify-Topic': topic
                    }
                );
                return { received: true };
            }
        );

        // Always respond 200 to acknowledge receipt
        res.status(200).json({
            received: true,
            isNew,
            webhookId: shopifyWebhookId
        });

    } catch (error: any) {
        console.error('Error receiving webhook:', error);
        // Still return 200 to prevent Shopify retries if we at least received it
        res.status(200).json({ received: false, error: error.message });
    }
});

/**
 * GET /webhooks/dead-letter
 * Admin endpoint to view Dead Letter Queue
 */
router.get('/dead-letter', async (req: Request, res: Response) => {
    try {
        const limit = parseInt(req.query.limit as string) || 50;
        const deadLetters = await getDeadLetterQueue(limit);

        res.json({
            count: deadLetters.length,
            webhooks: deadLetters.map(w => ({
                id: w.id,
                topic: w.topic,
                shopifyWebhookId: w.shopifyWebhookId,
                attempts: w.attempts,
                lastError: w.lastError,
                receivedAt: w.receivedAt,
                updatedAt: w.updatedAt
            }))
        });
    } catch (error: any) {
        console.error('Error fetching dead letter queue:', error);
        res.status(500).json({ error: 'Failed to fetch dead letter queue' });
    }
});

/**
 * POST /webhooks/dead-letter/:id/retry
 * Manually retry a dead letter webhook
 */
router.post('/dead-letter/:id/retry', async (req: Request, res: Response) => {
    try {
        await retryDeadLetterWebhook(req.params.id);
        res.json({ message: 'Webhook queued for retry' });
    } catch (error: any) {
        console.error('Error retrying webhook:', error);
        res.status(500).json({ error: 'Failed to retry webhook' });
    }
});

export default router;
