import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

const SHOPIFY_WEBHOOK_SECRET = process.env.SHOPIFY_WEBHOOK_SECRET || '';

/**
 * Middleware to verify Shopify webhook signatures using HMAC-SHA256.
 * CRITICAL: This prevents webhook spoofing attacks.
 */
export function verifyShopifyWebhook(
    req: Request,
    res: Response,
    next: NextFunction
): void {
    const hmacHeader = req.get('X-Shopify-Hmac-Sha256');

    if (!hmacHeader) {
        console.error('Webhook rejected: Missing HMAC header');
        res.status(401).json({ error: 'Missing HMAC header' });
        return;
    }

    // CRITICAL: Use raw body, not parsed JSON
    const rawBody = (req as any).rawBody;

    if (!rawBody) {
        console.error('Webhook rejected: Raw body not captured');
        res.status(500).json({ error: 'Raw body not captured' });
        return;
    }

    const calculatedHmac = crypto
        .createHmac('sha256', SHOPIFY_WEBHOOK_SECRET)
        .update(rawBody, 'utf8')
        .digest('base64');

    // Use timing-safe comparison to prevent timing attacks
    let isValid = false;
    try {
        isValid = crypto.timingSafeEqual(
            Buffer.from(hmacHeader),
            Buffer.from(calculatedHmac)
        );
    } catch {
        // Buffer lengths don't match
        isValid = false;
    }

    if (!isValid) {
        console.error('Webhook rejected: Invalid HMAC signature');
        res.status(401).json({ error: 'Invalid signature' });
        return;
    }

    console.log('Webhook HMAC verification passed');
    next();
}

/**
 * Express middleware configuration to capture raw body for HMAC verification.
 * Must be applied BEFORE json parsing middleware.
 */
export function captureRawBody(req: Request, res: Response, buf: Buffer): void {
    (req as any).rawBody = buf.toString('utf8');
}
