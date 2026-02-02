import prisma from '../prisma.js';

/**
 * Get all active products with their variants.
 */
export async function getAllProducts() {
    return prisma.product.findMany({
        where: { isActive: true },
        include: {
            variants: {
                where: { inventoryQty: { gt: 0 } }
            }
        },
        orderBy: { createdAt: 'desc' }
    });
}

/**
 * Get a single product by ID or handle.
 */
export async function getProduct(idOrHandle: string) {
    return prisma.product.findFirst({
        where: {
            OR: [
                { id: idOrHandle },
                { handle: idOrHandle }
            ],
            isActive: true
        },
        include: { variants: true }
    });
}

/**
 * Sync products from Shopify (called via webhook or manually).
 */
export async function syncProduct(shopifyProduct: any) {
    const {
        id: shopifyId,
        title,
        body_html: description,
        handle,
        variants,
        images
    } = shopifyProduct;

    const priceInCents = variants?.[0]?.price
        ? Math.round(parseFloat(variants[0].price) * 100)
        : 0;

    const imageUrl = images?.[0]?.src || null;

    // Upsert product
    const product = await prisma.product.upsert({
        where: { shopifyId: String(shopifyId) },
        create: {
            shopifyId: String(shopifyId),
            title,
            description,
            handle,
            priceInCents,
            imageUrl,
            isActive: true
        },
        update: {
            title,
            description,
            handle,
            priceInCents,
            imageUrl
        }
    });

    // Sync variants
    if (variants && variants.length > 0) {
        for (const variant of variants) {
            await prisma.productVariant.upsert({
                where: { shopifyId: String(variant.id) },
                create: {
                    shopifyId: String(variant.id),
                    productId: product.id,
                    title: variant.title,
                    sku: variant.sku,
                    priceInCents: Math.round(parseFloat(variant.price) * 100),
                    inventoryQty: variant.inventory_quantity || 0
                },
                update: {
                    title: variant.title,
                    sku: variant.sku,
                    priceInCents: Math.round(parseFloat(variant.price) * 100),
                    inventoryQty: variant.inventory_quantity || 0
                }
            });
        }
    }

    return product;
}

/**
 * Create sample products for development/testing.
 */
export async function seedSampleProducts() {
    const sampleProducts = [
        {
            shopifyId: 'sample-1',
            title: 'Premium Wireless Headphones',
            description: 'High-quality wireless headphones with noise cancellation',
            handle: 'premium-wireless-headphones',
            priceInCents: 29999,
            imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400',
            variants: [
                { shopifyId: 'sample-1-black', title: 'Black', sku: 'HP-BLK-001', priceInCents: 29999 },
                { shopifyId: 'sample-1-white', title: 'White', sku: 'HP-WHT-001', priceInCents: 29999 }
            ]
        },
        {
            shopifyId: 'sample-2',
            title: 'Smart Watch Pro',
            description: 'Advanced smartwatch with health monitoring',
            handle: 'smart-watch-pro',
            priceInCents: 39999,
            imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400',
            variants: [
                { shopifyId: 'sample-2-silver', title: 'Silver', sku: 'SW-SLV-001', priceInCents: 39999 },
                { shopifyId: 'sample-2-gold', title: 'Gold', sku: 'SW-GLD-001', priceInCents: 44999 }
            ]
        },
        {
            shopifyId: 'sample-3',
            title: 'Portable Bluetooth Speaker',
            description: 'Compact speaker with 20-hour battery life',
            handle: 'portable-bluetooth-speaker',
            priceInCents: 7999,
            imageUrl: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=400',
            variants: [
                { shopifyId: 'sample-3-blue', title: 'Blue', sku: 'SP-BLU-001', priceInCents: 7999 }
            ]
        },
        {
            shopifyId: 'sample-4',
            title: 'Mechanical Keyboard RGB',
            description: 'Gaming mechanical keyboard with RGB backlighting',
            handle: 'mechanical-keyboard-rgb',
            priceInCents: 14999,
            imageUrl: 'https://images.unsplash.com/photo-1511467687858-23d96c32e4ae?w=400',
            variants: [
                { shopifyId: 'sample-4-cherry', title: 'Cherry MX Red', sku: 'KB-RED-001', priceInCents: 14999 },
                { shopifyId: 'sample-4-blue', title: 'Cherry MX Blue', sku: 'KB-BLU-001', priceInCents: 14999 }
            ]
        },
        {
            shopifyId: 'sample-5',
            title: 'Wireless Charging Pad',
            description: 'Fast wireless charger compatible with all Qi devices',
            handle: 'wireless-charging-pad',
            priceInCents: 3999,
            imageUrl: 'https://images.unsplash.com/photo-1586816879360-004f5b0c51e5?w=400',
            variants: [
                { shopifyId: 'sample-5-black', title: 'Black', sku: 'WC-BLK-001', priceInCents: 3999 }
            ]
        },
        {
            shopifyId: 'sample-6',
            title: 'Ultra HD Webcam',
            description: '4K webcam with auto-focus and low-light correction',
            handle: 'ultra-hd-webcam',
            priceInCents: 12999,
            imageUrl: 'https://images.unsplash.com/photo-1587826080692-f439cd0b70da?w=400',
            variants: [
                { shopifyId: 'sample-6-standard', title: 'Standard', sku: 'WB-STD-001', priceInCents: 12999 }
            ]
        }
    ];

    for (const product of sampleProducts) {
        const created = await prisma.product.upsert({
            where: { shopifyId: product.shopifyId },
            create: {
                shopifyId: product.shopifyId,
                title: product.title,
                description: product.description,
                handle: product.handle,
                priceInCents: product.priceInCents,
                imageUrl: product.imageUrl,
                isActive: true
            },
            update: {
                title: product.title,
                description: product.description,
                priceInCents: product.priceInCents,
                imageUrl: product.imageUrl
            }
        });

        for (const variant of product.variants) {
            await prisma.productVariant.upsert({
                where: { shopifyId: variant.shopifyId },
                create: {
                    shopifyId: variant.shopifyId,
                    productId: created.id,
                    title: variant.title,
                    sku: variant.sku,
                    priceInCents: variant.priceInCents,
                    inventoryQty: 100
                },
                update: {
                    title: variant.title,
                    sku: variant.sku,
                    priceInCents: variant.priceInCents
                }
            });
        }
    }

    console.log(`Seeded ${sampleProducts.length} sample products`);
}
