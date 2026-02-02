import prisma from '../prisma.js';
import { OrderStatus, TransactionStatus, TransactionType } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

export interface CartItem {
    productId: string;
    variantId?: string;
    quantity: number;
}

export interface CreateCheckoutRequest {
    cartId: string;
    items: CartItem[];
    email?: string;
}

export interface CheckoutResponse {
    orderId: string;
    redirectUrl: string;
    checkoutToken: string;
}

/**
 * Create a checkout session and order record.
 * Returns a Shopify checkout URL for the customer to complete payment.
 */
export async function createCheckout(
    request: CreateCheckoutRequest
): Promise<CheckoutResponse> {
    const { cartId, items, email } = request;

    // Validate cart has items
    if (!items || items.length === 0) {
        throw new Error('Cart is empty');
    }

    // Fetch products and calculate totals
    const productIds = [...new Set(items.map(i => i.productId))];
    const products = await prisma.product.findMany({
        where: {
            id: { in: productIds },
            isActive: true
        },
        include: { variants: true }
    });

    if (products.length === 0) {
        throw new Error('No valid products found');
    }

    // Build order items with pricing
    let subtotalInCents = 0;
    const orderItems = items.map(item => {
        const product = products.find(p => p.id === item.productId);
        if (!product) {
            throw new Error(`Product not found: ${item.productId}`);
        }

        const variant = item.variantId
            ? product.variants.find(v => v.id === item.variantId)
            : null;

        const unitPrice = variant?.priceInCents || product.priceInCents;
        const itemTotal = unitPrice * item.quantity;
        subtotalInCents += itemTotal;

        return {
            productId: product.id,
            variantId: variant?.id || null,
            quantity: item.quantity,
            unitPriceInCents: unitPrice,
            totalInCents: itemTotal,
            productTitle: product.title,
            variantTitle: variant?.title || null
        };
    });

    // Calculate totals (tax calculation would go here in production)
    const taxInCents = 0; // Placeholder - implement tax calculation
    const shippingInCents = 0; // Placeholder - implement shipping calculation
    const totalInCents = subtotalInCents + taxInCents + shippingInCents;

    // Generate checkout token (in production, this comes from Shopify)
    const checkoutToken = uuidv4();

    // Create order with items in a transaction
    const order = await prisma.$transaction(async (tx) => {
        const newOrder = await tx.order.create({
            data: {
                cartId,
                customerEmail: email,
                status: OrderStatus.PENDING,
                subtotalInCents,
                taxInCents,
                shippingInCents,
                totalInCents,
                shopifyCheckoutToken: checkoutToken,
                items: {
                    create: orderItems
                }
            },
            include: { items: true }
        });

        // Create initial transaction record
        await tx.transaction.create({
            data: {
                orderId: newOrder.id,
                type: TransactionType.PAYMENT,
                status: TransactionStatus.INITIATED,
                amountInCents: totalInCents,
                idempotencyKey: `checkout-${checkoutToken}`
            }
        });

        return newOrder;
    });

    // In production, create actual Shopify checkout here
    // For now, return a mock checkout URL
    const shopifyStoreUrl = process.env.SHOPIFY_STORE_URL || 'your-store.myshopify.com';
    const redirectUrl = `https://${shopifyStoreUrl}/checkouts/${checkoutToken}`;

    return {
        orderId: order.id,
        redirectUrl,
        checkoutToken
    };
}

/**
 * Get order status by ID.
 */
export async function getOrderStatus(orderId: string) {
    const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
            items: true,
            transactions: {
                orderBy: { createdAt: 'desc' },
                take: 1
            }
        }
    });

    if (!order) {
        return null;
    }

    return {
        id: order.id,
        status: order.status,
        totalInCents: order.totalInCents,
        currency: order.currency,
        itemCount: order.items.length,
        latestTransaction: order.transactions[0] || null,
        createdAt: order.createdAt,
        completedAt: order.completedAt
    };
}

/**
 * Get order by cart ID (for checking if cart was already submitted).
 */
export async function getOrderByCartId(cartId: string) {
    return prisma.order.findFirst({
        where: { cartId },
        orderBy: { createdAt: 'desc' }
    });
}
