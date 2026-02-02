import { Router, Request, Response } from 'express';
import { getAllProducts, getProduct, seedSampleProducts } from '../services/product.service.js';

const router = Router();

/**
 * GET /api/products
 * List all active products with variants
 */
router.get('/', async (req: Request, res: Response) => {
    try {
        const products = await getAllProducts();

        // Format for frontend consumption
        const formattedProducts = products.map(product => ({
            id: product.id,
            title: product.title,
            description: product.description,
            handle: product.handle,
            price: product.priceInCents / 100,
            priceFormatted: `$${(product.priceInCents / 100).toFixed(2)}`,
            currency: product.currency,
            imageUrl: product.imageUrl,
            variants: product.variants.map(v => ({
                id: v.id,
                title: v.title,
                sku: v.sku,
                price: v.priceInCents / 100,
                priceFormatted: `$${(v.priceInCents / 100).toFixed(2)}`,
                inStock: v.inventoryQty > 0
            }))
        }));

        res.json({ products: formattedProducts });
    } catch (error: any) {
        console.error('Error fetching products:', error);
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});

/**
 * GET /api/products/:idOrHandle
 * Get single product by ID or handle
 */
router.get('/:idOrHandle', async (req: Request, res: Response) => {
    try {
        const product = await getProduct(req.params.idOrHandle);

        if (!product) {
            res.status(404).json({ error: 'Product not found' });
            return;
        }

        res.json({
            id: product.id,
            title: product.title,
            description: product.description,
            handle: product.handle,
            price: product.priceInCents / 100,
            priceFormatted: `$${(product.priceInCents / 100).toFixed(2)}`,
            currency: product.currency,
            imageUrl: product.imageUrl,
            variants: product.variants.map(v => ({
                id: v.id,
                title: v.title,
                sku: v.sku,
                price: v.priceInCents / 100,
                priceFormatted: `$${(v.priceInCents / 100).toFixed(2)}`,
                inStock: v.inventoryQty > 0
            }))
        });
    } catch (error: any) {
        console.error('Error fetching product:', error);
        res.status(500).json({ error: 'Failed to fetch product' });
    }
});

/**
 * POST /api/products/seed
 * Seed sample products (development only)
 */
router.post('/seed', async (req: Request, res: Response) => {
    if (process.env.NODE_ENV === 'production') {
        res.status(403).json({ error: 'Not available in production' });
        return;
    }

    try {
        await seedSampleProducts();
        res.json({ message: 'Sample products seeded successfully' });
    } catch (error: any) {
        console.error('Error seeding products:', error);
        res.status(500).json({ error: 'Failed to seed products' });
    }
});

export default router;
