/**
 * TechShop - Headless E-Commerce Frontend
 * Cart Management with localStorage persistence
 * No login required - guest checkout
 */

// ==============================================
// CONFIGURATION
// ==============================================
const API_BASE_URL = 'http://localhost:3001';

// ==============================================
// CART STATE MANAGEMENT
// ==============================================
class Cart {
  constructor() {
    this.items = [];
    this.cartId = this.getOrCreateCartId();
    this.load();
  }

  getOrCreateCartId() {
    let cartId = localStorage.getItem('cartId');
    if (!cartId) {
      cartId = this.generateUUID();
      localStorage.setItem('cartId', cartId);
    }
    return cartId;
  }

  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  load() {
    try {
      const stored = localStorage.getItem('cart');
      if (stored) {
        this.items = JSON.parse(stored);
      }
    } catch (e) {
      console.error('Failed to load cart:', e);
      this.items = [];
    }
  }

  save() {
    localStorage.setItem('cart', JSON.stringify(this.items));
    this.updateCartBadge();
    this.renderCartItems();
  }

  addItem(product, variant = null) {
    const existingIndex = this.items.findIndex(item => 
      item.productId === product.id && 
      ((!variant && !item.variantId) || (variant && item.variantId === variant.id))
    );

    if (existingIndex >= 0) {
      this.items[existingIndex].quantity += 1;
    } else {
      this.items.push({
        productId: product.id,
        variantId: variant?.id || null,
        quantity: 1,
        // Store product info for display
        title: product.title,
        variantTitle: variant?.title || null,
        priceFormatted: variant?.priceFormatted || product.priceFormatted,
        price: variant?.price || product.price,
        imageUrl: product.imageUrl
      });
    }

    this.save();
    showToast(`${product.title} added to cart!`);
  }

  updateQuantity(productId, variantId, quantity) {
    const index = this.items.findIndex(item => 
      item.productId === productId && item.variantId === variantId
    );

    if (index >= 0) {
      if (quantity <= 0) {
        this.items.splice(index, 1);
      } else {
        this.items[index].quantity = quantity;
      }
      this.save();
    }
  }

  removeItem(productId, variantId) {
    this.items = this.items.filter(item => 
      !(item.productId === productId && item.variantId === variantId)
    );
    this.save();
  }

  clear() {
    this.items = [];
    this.cartId = this.generateUUID();
    localStorage.setItem('cartId', this.cartId);
    this.save();
  }

  getTotalItems() {
    return this.items.reduce((sum, item) => sum + item.quantity, 0);
  }

  getSubtotal() {
    return this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }

  getTotal() {
    // Add tax/shipping here if needed
    return this.getSubtotal();
  }

  updateCartBadge() {
    const badge = document.getElementById('cartBadge');
    const count = this.getTotalItems();
    
    if (badge) {
      badge.textContent = count;
      badge.classList.toggle('visible', count > 0);
    }
  }

  renderCartItems() {
    const itemsContainer = document.getElementById('cartItems');
    const emptyState = document.getElementById('cartEmpty');
    const footer = document.getElementById('cartFooter');
    const subtotalEl = document.getElementById('cartSubtotal');
    const totalEl = document.getElementById('cartTotal');

    if (!itemsContainer) return;

    if (this.items.length === 0) {
      itemsContainer.innerHTML = '';
      emptyState?.classList.add('visible');
      footer?.classList.add('hidden');
      return;
    }

    emptyState?.classList.remove('visible');
    footer?.classList.remove('hidden');

    itemsContainer.innerHTML = this.items.map(item => `
      <div class="cart-item" data-product-id="${item.productId}" data-variant-id="${item.variantId || ''}">
        <div class="cart-item__image">
          <img src="${item.imageUrl || 'https://via.placeholder.com/80'}" alt="${item.title}" />
        </div>
        <div class="cart-item__details">
          <h4 class="cart-item__title">${item.title}</h4>
          ${item.variantTitle ? `<p class="cart-item__variant">${item.variantTitle}</p>` : ''}
          <p class="cart-item__price">${item.priceFormatted}</p>
        </div>
        <div class="cart-item__actions">
          <div class="cart-item__quantity">
            <button class="cart-item__qty-btn" data-action="decrease">−</button>
            <span class="cart-item__qty-value">${item.quantity}</span>
            <button class="cart-item__qty-btn" data-action="increase">+</button>
          </div>
          <button class="cart-item__remove" data-action="remove" aria-label="Remove item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </div>
    `).join('');

    // Update totals
    if (subtotalEl) subtotalEl.textContent = `$${this.getSubtotal().toFixed(2)}`;
    if (totalEl) totalEl.textContent = `$${this.getTotal().toFixed(2)}`;

    // Add event listeners to cart item buttons
    this.attachCartItemListeners();
  }

  attachCartItemListeners() {
    const cartItems = document.querySelectorAll('.cart-item');
    
    cartItems.forEach(item => {
      const productId = item.dataset.productId;
      const variantId = item.dataset.variantId || null;

      item.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', () => {
          const action = btn.dataset.action;
          const currentItem = this.items.find(i => 
            i.productId === productId && i.variantId === variantId
          );

          if (!currentItem) return;

          switch (action) {
            case 'increase':
              this.updateQuantity(productId, variantId, currentItem.quantity + 1);
              break;
            case 'decrease':
              this.updateQuantity(productId, variantId, currentItem.quantity - 1);
              break;
            case 'remove':
              this.removeItem(productId, variantId);
              break;
          }
        });
      });
    });
  }

  async checkout(email) {
    if (this.items.length === 0) {
      throw new Error('Cart is empty');
    }

    const checkoutData = {
      cartId: this.cartId,
      items: this.items.map(item => ({
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity
      })),
      email: email || undefined
    };

    const response = await fetch(`${API_BASE_URL}/api/checkout/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(checkoutData)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Checkout failed');
    }

    const result = await response.json();
    
    // Clear cart after successful checkout
    this.clear();
    
    return result;
  }
}

// ==============================================
// PRODUCT LOADING
// ==============================================
async function loadProducts() {
  const grid = document.getElementById('productsGrid');
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/products`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch products');
    }
    
    const data = await response.json();
    renderProducts(data.products);
    
  } catch (error) {
    console.error('Error loading products:', error);
    
    // Show fallback demo products
    const demoProducts = getDemoProducts();
    renderProducts(demoProducts);
  }
}

function getDemoProducts() {
  return [
    {
      id: 'demo-1',
      title: 'Classic Leather Backpack',
      description: 'Handcrafted genuine leather backpack with laptop compartment',
      handle: 'classic-leather-backpack',
      price: 189.99,
      priceFormatted: '$189.99',
      emoji: '🎒',
      imageUrl: null,
      variants: [
        { id: 'demo-1-brown', title: 'Brown', price: 189.99, priceFormatted: '$189.99', inStock: true },
        { id: 'demo-1-black', title: 'Black', price: 189.99, priceFormatted: '$189.99', inStock: true }
      ]
    },
    {
      id: 'demo-2',
      title: 'Premium Running Shoes',
      description: 'Lightweight performance shoes with responsive cushioning',
      handle: 'premium-running-shoes',
      price: 149.99,
      priceFormatted: '$149.99',
      emoji: '👟',
      imageUrl: null,
      variants: [
        { id: 'demo-2-9', title: 'Size 9', price: 149.99, priceFormatted: '$149.99', inStock: true },
        { id: 'demo-2-10', title: 'Size 10', price: 149.99, priceFormatted: '$149.99', inStock: true },
        { id: 'demo-2-11', title: 'Size 11', price: 149.99, priceFormatted: '$149.99', inStock: true }
      ]
    },
    {
      id: 'demo-3',
      title: 'Cozy Wool Sweater',
      description: 'Soft merino wool pullover, perfect for any season',
      handle: 'cozy-wool-sweater',
      price: 89.99,
      priceFormatted: '$89.99',
      emoji: '🧥',
      imageUrl: null,
      variants: [
        { id: 'demo-3-s', title: 'Small', price: 89.99, priceFormatted: '$89.99', inStock: true },
        { id: 'demo-3-m', title: 'Medium', price: 89.99, priceFormatted: '$89.99', inStock: true },
        { id: 'demo-3-l', title: 'Large', price: 89.99, priceFormatted: '$89.99', inStock: true }
      ]
    },
    {
      id: 'demo-4',
      title: 'Minimalist Watch',
      description: 'Clean design with Japanese movement and sapphire crystal',
      handle: 'minimalist-watch',
      price: 249.99,
      priceFormatted: '$249.99',
      emoji: '⌚',
      imageUrl: null,
      variants: [
        { id: 'demo-4-silver', title: 'Silver', price: 249.99, priceFormatted: '$249.99', inStock: true },
        { id: 'demo-4-gold', title: 'Gold', price: 279.99, priceFormatted: '$279.99', inStock: true }
      ]
    },
    {
      id: 'demo-5',
      title: 'Organic Cotton T-Shirt',
      description: '100% organic cotton, ethically sourced and produced',
      handle: 'organic-cotton-tshirt',
      price: 35.00,
      priceFormatted: '$35.00',
      emoji: '👕',
      imageUrl: null,
      variants: []
    },
    {
      id: 'demo-6',
      title: 'Designer Sunglasses',
      description: 'UV400 protection with polarized lenses and metal frame',
      handle: 'designer-sunglasses',
      price: 129.99,
      priceFormatted: '$129.99',
      emoji: '🕶️',
      imageUrl: null,
      variants: []
    },
    {
      id: 'demo-7',
      title: 'Artisan Coffee Beans',
      description: 'Single-origin arabica beans, medium roast, 12oz bag',
      handle: 'artisan-coffee-beans',
      price: 24.99,
      priceFormatted: '$24.99',
      emoji: '☕',
      imageUrl: null,
      variants: []
    },
    {
      id: 'demo-8',
      title: 'Yoga Mat Premium',
      description: 'Non-slip eco-friendly mat with alignment guides',
      handle: 'yoga-mat-premium',
      price: 68.00,
      priceFormatted: '$68.00',
      emoji: '🧘',
      imageUrl: null,
      variants: [
        { id: 'demo-8-purple', title: 'Purple', price: 68.00, priceFormatted: '$68.00', inStock: true },
        { id: 'demo-8-teal', title: 'Teal', price: 68.00, priceFormatted: '$68.00', inStock: true }
      ]
    }
  ];
}

function renderProducts(products) {
  const grid = document.getElementById('productsGrid');
  
  if (!products || products.length === 0) {
    grid.innerHTML = '<p class="products__loading">No products available</p>';
    return;
  }
  
  grid.innerHTML = products.map(product => `
    <article class="product-card" data-product-id="${product.id}">
      <div class="product-card__image">
        ${product.imageUrl 
          ? `<img src="${product.imageUrl}" alt="${product.title}" loading="lazy" />`
          : `<span class="product-card__emoji">${product.emoji || '🛍️'}</span>`
        }
        ${product.variants && product.variants.length > 0 ? '<span class="product-card__badge">Options</span>' : ''}
      </div>
      <div class="product-card__content">
        <h3 class="product-card__title">${product.title}</h3>
        <p class="product-card__description">${product.description || ''}</p>
        <p class="product-card__price">${product.priceFormatted}</p>
        
        ${product.variants && product.variants.length > 0 ? `
          <div class="product-card__variants">
            ${product.variants.map((v, i) => `
              <button class="variant-btn ${i === 0 ? 'selected' : ''}" 
                      data-variant-id="${v.id}" 
                      data-variant-price="${v.price}"
                      data-variant-price-formatted="${v.priceFormatted}"
                      data-variant-title="${v.title}">
                ${v.title}
              </button>
            `).join('')}
          </div>
        ` : ''}
        
        <div class="product-card__actions">
          <button class="product-card__add-btn" data-add-to-cart>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <path d="M16 10a4 4 0 0 1-8 0"></path>
            </svg>
            Add to Cart
          </button>
        </div>
      </div>
    </article>
  `).join('');

  // Store products data for later reference
  window.productsData = products;

  // Add event listeners
  attachProductListeners();
}

function attachProductListeners() {
  // Variant selection
  document.querySelectorAll('.variant-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const card = e.target.closest('.product-card');
      card.querySelectorAll('.variant-btn').forEach(b => b.classList.remove('selected'));
      e.target.classList.add('selected');
      
      // Update displayed price
      const priceEl = card.querySelector('.product-card__price');
      if (priceEl) {
        priceEl.textContent = e.target.dataset.variantPriceFormatted;
      }
    });
  });

  // Add to cart
  document.querySelectorAll('[data-add-to-cart]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const card = e.target.closest('.product-card');
      const productId = card.dataset.productId;
      const product = window.productsData?.find(p => p.id === productId);
      
      if (!product) return;

      // Check for selected variant
      const selectedVariantBtn = card.querySelector('.variant-btn.selected');
      let variant = null;
      
      if (selectedVariantBtn) {
        variant = {
          id: selectedVariantBtn.dataset.variantId,
          title: selectedVariantBtn.dataset.variantTitle,
          price: parseFloat(selectedVariantBtn.dataset.variantPrice),
          priceFormatted: selectedVariantBtn.dataset.variantPriceFormatted
        };
      }

      window.cart.addItem(product, variant);
    });
  });
}

// ==============================================
// CART SIDEBAR
// ==============================================
function setupCartSidebar() {
  const sidebar = document.getElementById('cartSidebar');
  const toggle = document.getElementById('cartToggle');
  const close = document.getElementById('cartClose');
  const overlay = document.getElementById('cartOverlay');
  const continueBtn = document.getElementById('continueShopping');
  const checkoutBtn = document.getElementById('checkoutBtn');

  const openCart = () => sidebar?.classList.add('open');
  const closeCart = () => sidebar?.classList.remove('open');

  toggle?.addEventListener('click', openCart);
  close?.addEventListener('click', closeCart);
  overlay?.addEventListener('click', closeCart);
  continueBtn?.addEventListener('click', closeCart);

  // Escape key closes cart
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeCart();
  });

  // Checkout button
  checkoutBtn?.addEventListener('click', async () => {
    const email = document.getElementById('checkoutEmail')?.value;
    
    if (window.cart.items.length === 0) {
      showToast('Your cart is empty');
      return;
    }

    checkoutBtn.disabled = true;
    checkoutBtn.innerHTML = '<span class="checkout__text">Processing...</span>';

    try {
      const result = await window.cart.checkout(email);
      
      // Show success modal
      showCheckoutSuccess(result);
      closeCart();

    } catch (error) {
      console.error('Checkout error:', error);
      
      // If it's a CORS or network error, show demo success
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        showDemoCheckoutSuccess();
        closeCart();
      } else {
        showToast(error.message || 'Checkout failed. Please try again.');
      }
    } finally {
      checkoutBtn.disabled = false;
      checkoutBtn.innerHTML = `
        <span class="checkout__text">Proceed to Checkout</span>
        <svg class="checkout__arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="5" y1="12" x2="19" y2="12"></line>
          <polyline points="12 5 19 12 12 19"></polyline>
        </svg>
      `;
    }
  });
}

// ==============================================
// CHECKOUT SUCCESS MODAL
// ==============================================
function showCheckoutSuccess(result) {
  const modal = document.createElement('div');
  modal.className = 'checkout-success-modal';
  modal.innerHTML = `
    <div class="checkout-success-content">
      <div class="checkout-success-icon">✓</div>
      <h2>Order Created Successfully!</h2>
      <div class="checkout-success-details">
        <p><strong>Order ID:</strong> ${result.orderId}</p>
        <p><strong>Checkout Token:</strong> ${result.checkoutToken}</p>
      </div>
      <p class="checkout-success-note">
        In production, you would be redirected to Shopify checkout:<br>
        <code>${result.redirectUrl}</code>
      </p>
      <button class="checkout-success-btn" onclick="this.parentElement.parentElement.remove()">
        Continue Shopping
      </button>
    </div>
  `;
  document.body.appendChild(modal);
  
  // Add styles if not already added
  if (!document.getElementById('checkout-success-styles')) {
    const style = document.createElement('style');
    style.id = 'checkout-success-styles';
    style.textContent = `
      .checkout-success-modal {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        padding: 1rem;
      }
      .checkout-success-content {
        background: var(--color-bg-secondary, #12121a);
        border: 1px solid var(--color-border, rgba(255,255,255,0.1));
        border-radius: 1rem;
        padding: 2rem;
        max-width: 450px;
        text-align: center;
      }
      .checkout-success-icon {
        width: 60px;
        height: 60px;
        background: linear-gradient(135deg, #10b981, #059669);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 2rem;
        margin: 0 auto 1rem;
        color: white;
      }
      .checkout-success-content h2 {
        margin-bottom: 1rem;
        color: #10b981;
      }
      .checkout-success-details {
        background: rgba(255,255,255,0.05);
        padding: 1rem;
        border-radius: 0.5rem;
        margin-bottom: 1rem;
        text-align: left;
      }
      .checkout-success-details p {
        margin: 0.5rem 0;
        font-size: 0.875rem;
        color: var(--color-text-secondary, #a1a1aa);
        word-break: break-all;
      }
      .checkout-success-note {
        font-size: 0.75rem;
        color: var(--color-text-tertiary, #71717a);
        margin-bottom: 1.5rem;
      }
      .checkout-success-note code {
        display: block;
        margin-top: 0.5rem;
        padding: 0.5rem;
        background: rgba(0,0,0,0.3);
        border-radius: 0.25rem;
        word-break: break-all;
      }
      .checkout-success-btn {
        background: var(--color-accent, #6366f1);
        color: white;
        border: none;
        padding: 0.75rem 1.5rem;
        border-radius: 0.5rem;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.2s;
      }
      .checkout-success-btn:hover {
        background: var(--color-accent-light, #818cf8);
      }
    `;
    document.head.appendChild(style);
  }
}

function showDemoCheckoutSuccess() {
  // Simulate checkout for demo mode when API is blocked
  const demoOrderId = 'demo-' + Date.now().toString(36);
  window.cart.clear();
  
  showCheckoutSuccess({
    orderId: demoOrderId,
    checkoutToken: 'demo-token-' + Math.random().toString(36).substr(2, 9),
    redirectUrl: 'https://example-store.myshopify.com/checkouts/' + demoOrderId
  });
  
  showToast('Demo checkout completed!');
}

// ==============================================
// TOAST NOTIFICATIONS
// ==============================================
function showToast(message) {
  const toast = document.getElementById('toast');
  const messageEl = document.getElementById('toastMessage');
  
  if (!toast || !messageEl) return;
  
  messageEl.textContent = message;
  toast.classList.add('visible');
  
  setTimeout(() => {
    toast.classList.remove('visible');
  }, 3000);
}

// ==============================================
// INITIALIZATION
// ==============================================
document.addEventListener('DOMContentLoaded', () => {
  // Initialize cart
  window.cart = new Cart();
  
  // Setup cart sidebar
  setupCartSidebar();
  
  // Initialize cart display
  window.cart.updateCartBadge();
  window.cart.renderCartItems();
  
  // Load products
  loadProducts();
  
  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const href = anchor.getAttribute('href');
      if (href === '#') return;
      
      e.preventDefault();
      const target = document.querySelector(href);
      target?.scrollIntoView({ behavior: 'smooth' });
    });
  });
  
  console.log('🛒 TechShop initialized');
  console.log('   Cart ID:', window.cart.cartId);
  console.log('   Items in cart:', window.cart.getTotalItems());
});
