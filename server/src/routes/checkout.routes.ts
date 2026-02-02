import { Router, Request, Response } from 'express';
import { createCheckout, getOrderStatus, getOrderByCartId } from '../services/checkout.service.js';

const router = Router();

/**
 * POST /api/checkout/create
 * Create a new checkout session from cart
 */
router.post('/create', async (req: Request, res: Response) => {
    try {
        const { cartId, items, email } = req.body;

        // Validate request
        if (!cartId) {
            res.status(400).json({ error: 'cartId is required' });
            return;
        }

        if (!items || !Array.isArray(items) || items.length === 0) {
            res.status(400).json({ error: 'items array is required and must not be empty' });
            return;
        }

        // Check if cart was already submitted
        const existingOrder = await getOrderByCartId(cartId);
        if (existingOrder && existingOrder.status !== 'CANCELLED') {
            res.status(409).json({
                error: 'Cart already submitted',
                orderId: existingOrder.id,
                status: existingOrder.status
            });
            return;
        }

        // Create checkout
        const checkout = await createCheckout({ cartId, items, email });

        res.status(201).json({
            orderId: checkout.orderId,
            redirectUrl: checkout.redirectUrl,
            checkoutToken: checkout.checkoutToken
        });

    } catch (error: any) {
        console.error('Error creating checkout:', error);
        res.status(500).json({ error: error.message || 'Failed to create checkout' });
    }
});

/**
 * GET /api/checkout/status/:orderId
 * Get order/checkout status
 */
router.get('/status/:orderId', async (req: Request, res: Response) => {
    try {
        const { orderId } = req.params;
        const status = await getOrderStatus(orderId);

        if (!status) {
            res.status(404).json({ error: 'Order not found' });
            return;
        }

        res.json(status);
    } catch (error: any) {
        console.error('Error fetching order status:', error);
        res.status(500).json({ error: 'Failed to fetch order status' });
    }
});

export default router;
