import prisma from '../prisma.js';
import { WebhookStatus, OrderStatus, TransactionStatus, TransactionType, LedgerEntryType, LedgerAccountType } from '@prisma/client';

// Retry delays in milliseconds (exponential backoff)
const RETRY_DELAYS = [
    1000,      // 1 second
    5000,      // 5 seconds
    30000,     // 30 seconds
    300000,    // 5 minutes
    1800000    // 30 minutes
];

/**
 * Store incoming webhook immediately and return 200.
 * Processing happens asynchronously via the worker.
 */
export async function receiveWebhook(
    shopifyWebhookId: string,
    topic: string,
    shopDomain: string,
    payload: object,
    headers: Record<string, string>
): Promise<void> {
    await prisma.webhookEvent.upsert({
        where: { shopifyWebhookId },
        create: {
            shopifyWebhookId,
            topic,
            shopDomain,
            payload: payload as any,
            headers: headers as any,
            status: WebhookStatus.RECEIVED,
            receivedAt: new Date()
        },
        update: {} // Ignore duplicates - already received
    });
}

/**
 * Process pending webhooks from the queue.
 * Called by the background worker.
 */
export async function processWebhookQueue(): Promise<void> {
    const pendingWebhooks = await prisma.webhookEvent.findMany({
        where: {
            status: { in: [WebhookStatus.RECEIVED, WebhookStatus.FAILED] },
            OR: [
                { nextRetryAt: null },
                { nextRetryAt: { lte: new Date() } }
            ]
        },
        orderBy: { receivedAt: 'asc' },
        take: 10
    });

    for (const webhook of pendingWebhooks) {
        await processWebhook(webhook);
    }
}

async function processWebhook(webhook: any): Promise<void> {
    try {
        // Update status to processing
        await prisma.webhookEvent.update({
            where: { id: webhook.id },
            data: {
                status: WebhookStatus.PROCESSING,
                attempts: { increment: 1 }
            }
        });

        // Route to appropriate handler based on topic
        await routeWebhook(webhook.topic, webhook.payload);

        // Mark as completed
        await prisma.webhookEvent.update({
            where: { id: webhook.id },
            data: {
                status: WebhookStatus.COMPLETED,
                processedAt: new Date()
            }
        });

        console.log(`Webhook processed successfully: ${webhook.topic} (${webhook.shopifyWebhookId})`);

    } catch (error: any) {
        const newAttempts = webhook.attempts + 1;

        if (newAttempts >= webhook.maxAttempts) {
            // Move to Dead Letter Queue
            await prisma.webhookEvent.update({
                where: { id: webhook.id },
                data: {
                    status: WebhookStatus.DEAD_LETTER,
                    lastError: error.message
                }
            });

            console.error(`Webhook moved to DLQ after ${newAttempts} attempts: ${webhook.topic}`, error.message);

            // Alert operations team (implement your alerting here)
            await alertDeadLetterWebhook(webhook, error);

        } else {
            // Schedule retry with exponential backoff
            const retryDelay = RETRY_DELAYS[newAttempts - 1] || RETRY_DELAYS[RETRY_DELAYS.length - 1];

            await prisma.webhookEvent.update({
                where: { id: webhook.id },
                data: {
                    status: WebhookStatus.FAILED,
                    lastError: error.message,
                    nextRetryAt: new Date(Date.now() + retryDelay)
                }
            });

            console.log(`Webhook scheduled for retry in ${retryDelay}ms: ${webhook.topic}`);
        }
    }
}

/**
 * Route webhook to the appropriate handler based on topic.
 */
async function routeWebhook(topic: string, payload: any): Promise<void> {
    switch (topic) {
        case 'checkouts/create':
            await handleCheckoutCreate(payload);
            break;
        case 'orders/create':
            await handleOrderCreate(payload);
            break;
        case 'orders/paid':
            await handleOrderPaid(payload);
            break;
        case 'orders/cancelled':
            await handleOrderCancelled(payload);
            break;
        case 'refunds/create':
            await handleRefundCreate(payload);
            break;
        default:
            console.log(`Unhandled webhook topic: ${topic}`);
    }
}

// ==============================================
// WEBHOOK HANDLERS
// ==============================================

async function handleCheckoutCreate(payload: any): Promise<void> {
    const checkoutToken = payload.token;

    // Update order status to PROCESSING
    await prisma.order.updateMany({
        where: { shopifyCheckoutToken: checkoutToken },
        data: {
            status: OrderStatus.PROCESSING,
            processingAt: new Date()
        }
    });

    console.log(`Checkout created: ${checkoutToken}`);
}

async function handleOrderCreate(payload: any): Promise<void> {
    const shopifyOrderId = String(payload.id);
    const checkoutToken = payload.checkout_token;

    // Link Shopify order ID to our order
    const order = await prisma.order.findFirst({
        where: { shopifyCheckoutToken: checkoutToken }
    });

    if (order) {
        await prisma.order.update({
            where: { id: order.id },
            data: { shopifyOrderId }
        });
        console.log(`Order linked: ${shopifyOrderId}`);
    } else {
        console.log(`Order not found for checkout: ${checkoutToken}`);
    }
}

async function handleOrderPaid(payload: any): Promise<void> {
    const shopifyOrderId = String(payload.id);
    const totalPrice = Math.round(parseFloat(payload.total_price) * 100);

    const order = await prisma.order.findUnique({
        where: { shopifyOrderId }
    });

    if (!order) {
        console.error(`Order not found: ${shopifyOrderId}`);
        return;
    }

    // Update order status and create transaction
    await prisma.$transaction(async (tx) => {
        // Update order to COMPLETED
        await tx.order.update({
            where: { id: order.id },
            data: {
                status: OrderStatus.COMPLETED,
                completedAt: new Date()
            }
        });

        // Create COMPLETED transaction
        const transaction = await tx.transaction.create({
            data: {
                orderId: order.id,
                shopifyTransactionId: `${shopifyOrderId}-payment`,
                type: TransactionType.PAYMENT,
                status: TransactionStatus.COMPLETED,
                amountInCents: totalPrice,
                currency: payload.currency || 'USD',
                idempotencyKey: `order-paid-${shopifyOrderId}`,
                completedAt: new Date()
            }
        });

        // Create ledger entries (double-entry bookkeeping)
        await tx.ledgerEntry.createMany({
            data: [
                {
                    orderId: order.id,
                    transactionId: transaction.id,
                    accountType: LedgerAccountType.CASH,
                    entryType: LedgerEntryType.DEBIT,
                    amountInCents: totalPrice,
                    description: `Payment received for order ${order.id}`
                },
                {
                    orderId: order.id,
                    transactionId: transaction.id,
                    accountType: LedgerAccountType.REVENUE,
                    entryType: LedgerEntryType.CREDIT,
                    amountInCents: totalPrice,
                    description: `Revenue from order ${order.id}`
                }
            ]
        });
    });

    console.log(`Order payment completed: ${shopifyOrderId}`);
}

async function handleOrderCancelled(payload: any): Promise<void> {
    const shopifyOrderId = String(payload.id);

    await prisma.order.updateMany({
        where: { shopifyOrderId },
        data: {
            status: OrderStatus.CANCELLED,
            cancelledAt: new Date()
        }
    });

    console.log(`Order cancelled: ${shopifyOrderId}`);
}

async function handleRefundCreate(payload: any): Promise<void> {
    const shopifyOrderId = String(payload.order_id);
    const refundAmount = payload.transactions?.reduce(
        (sum: number, t: any) => sum + Math.round(parseFloat(t.amount) * 100),
        0
    ) || 0;

    const order = await prisma.order.findUnique({
        where: { shopifyOrderId }
    });

    if (!order) {
        console.error(`Order not found for refund: ${shopifyOrderId}`);
        return;
    }

    await prisma.$transaction(async (tx) => {
        // Update order status
        await tx.order.update({
            where: { id: order.id },
            data: {
                status: refundAmount >= order.totalInCents
                    ? OrderStatus.REFUNDED
                    : OrderStatus.PARTIALLY_REFUNDED
            }
        });

        // Create refund transaction
        const transaction = await tx.transaction.create({
            data: {
                orderId: order.id,
                shopifyTransactionId: `refund-${payload.id}`,
                type: refundAmount >= order.totalInCents
                    ? TransactionType.REFUND
                    : TransactionType.PARTIAL_REFUND,
                status: TransactionStatus.COMPLETED,
                amountInCents: refundAmount,
                idempotencyKey: `refund-${payload.id}`,
                completedAt: new Date()
            }
        });

        // Create ledger entries for refund (reverse of payment)
        await tx.ledgerEntry.createMany({
            data: [
                {
                    orderId: order.id,
                    transactionId: transaction.id,
                    accountType: LedgerAccountType.REVENUE,
                    entryType: LedgerEntryType.DEBIT,
                    amountInCents: refundAmount,
                    description: `Refund for order ${order.id}`
                },
                {
                    orderId: order.id,
                    transactionId: transaction.id,
                    accountType: LedgerAccountType.CASH,
                    entryType: LedgerEntryType.CREDIT,
                    amountInCents: refundAmount,
                    description: `Refund disbursement for order ${order.id}`
                }
            ]
        });
    });

    console.log(`Refund processed: ${payload.id} for order ${shopifyOrderId}`);
}

/**
 * Alert operations team about dead letter webhooks.
 * Implement your preferred alerting mechanism here.
 */
async function alertDeadLetterWebhook(webhook: any, error: Error): Promise<void> {
    // TODO: Implement your alerting (Slack, PagerDuty, email, etc.)
    console.error('🚨 DEAD LETTER WEBHOOK ALERT 🚨');
    console.error('Topic:', webhook.topic);
    console.error('Webhook ID:', webhook.shopifyWebhookId);
    console.error('Error:', error.message);
    console.error('Payload:', JSON.stringify(webhook.payload, null, 2));
}

/**
 * Get Dead Letter Queue items for manual review/retry.
 */
export async function getDeadLetterQueue(limit: number = 50): Promise<any[]> {
    return prisma.webhookEvent.findMany({
        where: { status: WebhookStatus.DEAD_LETTER },
        orderBy: { createdAt: 'desc' },
        take: limit
    });
}

/**
 * Retry a specific dead letter webhook.
 */
export async function retryDeadLetterWebhook(webhookId: string): Promise<void> {
    await prisma.webhookEvent.update({
        where: { id: webhookId },
        data: {
            status: WebhookStatus.RECEIVED,
            attempts: 0,
            lastError: null,
            nextRetryAt: null
        }
    });
}
