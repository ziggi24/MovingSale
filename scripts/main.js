// State management
let allItems = [];
let filteredItems = [];
let activeTags = new Set();
let currentSort = 'lowest';

// DOM elements
const productsGrid = document.getElementById('products-grid');
const tagFiltersContainer = document.querySelector('.tag-filters');
const sortSelect = document.getElementById('sort-select');
const noResults = document.getElementById('no-results');
const modalOverlay = document.getElementById('modal-overlay');
const modalBody = document.getElementById('modal-body');
const modalClose = document.getElementById('modal-close');

// Initialize the application
async function init() {
    try {
        const response = await fetch('assets/list.json');
        if (!response.ok) {
            throw new Error('Failed to fetch items');
        }
        allItems = await response.json();
        
        // Extract unique tags
        const uniqueTags = extractUniqueTags(allItems);
        
        // Render tag filters
        renderTagFilters(uniqueTags);
        
        // Initial render
        filteredItems = [...allItems];
        applyFiltersAndSort();
        
        // Set up event listeners
        setupEventListeners();
    } catch (error) {
        console.error('Error loading items:', error);
        productsGrid.innerHTML = '<p style="text-align: center; padding: 2rem;">Error loading items. Please refresh the page.</p>';
    }
}

// Extract unique tags from all items
function extractUniqueTags(items) {
    const tagSet = new Set();
    items.forEach(item => {
        if (item.tags && Array.isArray(item.tags)) {
            item.tags.forEach(tag => tagSet.add(tag));
        }
    });
    return Array.from(tagSet).sort();
}

// Render tag filter buttons
function renderTagFilters(tags) {
    tagFiltersContainer.innerHTML = '';
    
    tags.forEach(tag => {
        const button = document.createElement('button');
        button.className = 'tag-filter-btn';
        button.textContent = tag;
        button.setAttribute('aria-pressed', 'false');
        button.setAttribute('data-tag', tag);
        button.addEventListener('click', () => toggleTagFilter(tag, button));
        tagFiltersContainer.appendChild(button);
    });
}

// Toggle tag filter
function toggleTagFilter(tag, button) {
    if (activeTags.has(tag)) {
        activeTags.delete(tag);
        button.classList.remove('active');
        button.setAttribute('aria-pressed', 'false');
    } else {
        activeTags.add(tag);
        button.classList.add('active');
        button.setAttribute('aria-pressed', 'true');
    }
    applyFiltersAndSort();
}

// Apply filters and sort
function applyFiltersAndSort() {
    // Filter by tags
    if (activeTags.size === 0) {
        filteredItems = [...allItems];
    } else {
        filteredItems = allItems.filter(item => {
            if (!item.tags || !Array.isArray(item.tags)) return false;
            return item.tags.some(tag => activeTags.has(tag));
        });
    }
    
    // Sort items
    sortItems();
    
    // Render items
    renderItems();
    
    // Show/hide no results message
    if (filteredItems.length === 0) {
        noResults.removeAttribute('hidden');
        productsGrid.setAttribute('hidden', '');
    } else {
        noResults.setAttribute('hidden', '');
        productsGrid.removeAttribute('hidden');
    }
}

// Sort items based on current sort option
function sortItems() {
    switch (currentSort) {
        case 'lowest':
            filteredItems.sort((a, b) => (a.price || 0) - (b.price || 0));
            break;
        case 'highest':
            filteredItems.sort((a, b) => (b.price || 0) - (a.price || 0));
            break;
        case 'alphabetical':
            filteredItems.sort((a, b) => {
                const nameA = (a.name || '').toLowerCase();
                const nameB = (b.name || '').toLowerCase();
                return nameA.localeCompare(nameB);
            });
            break;
    }
}

// Render product cards
function renderItems() {
    productsGrid.innerHTML = '';
    
    filteredItems.forEach((item, index) => {
        const card = createProductCard(item, index);
        productsGrid.appendChild(card);
    });
}

// Create a product card element
function createProductCard(item, index) {
    const card = document.createElement('article');
    card.className = 'product-card';
    card.setAttribute('role', 'listitem');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `Product: ${item.name}`);
    
    // Image
    const image = document.createElement('img');
    image.src = normalizeImagePath(item.img);
    image.alt = item.name || 'Product image';
    image.className = 'product-image';
    image.loading = 'lazy';
    image.onerror = function() {
        this.classList.add('image-error');
        this.alt = 'Image not available';
    };
    
    // Product info container
    const info = document.createElement('div');
    info.className = 'product-info';
    
    // Name
    const name = document.createElement('h3');
    name.className = 'product-name';
    name.textContent = item.name || 'Unnamed Item';
    
    // Price
    const price = document.createElement('div');
    price.className = 'product-price';
    price.textContent = formatPrice(item.price);
    
    // Tags
    const tagsContainer = document.createElement('div');
    tagsContainer.className = 'product-tags';
    if (item.tags && Array.isArray(item.tags)) {
        item.tags.forEach(tag => {
            const tagElement = document.createElement('span');
            tagElement.className = 'product-tag';
            tagElement.textContent = tag;
            tagsContainer.appendChild(tagElement);
        });
    }
    
    // Description preview
    const descriptionPreview = document.createElement('p');
    descriptionPreview.className = 'product-description-preview';
    descriptionPreview.textContent = item.description || 'No description available.';
    
    // Want it button
    const wantItBtn = document.createElement('a');
    wantItBtn.href = generateMailtoLink(item.name);
    wantItBtn.className = 'want-it-btn';
    wantItBtn.textContent = 'I want it';
    wantItBtn.setAttribute('aria-label', `Contact about ${item.name}`);
    
    // Prevent card click when clicking button
    wantItBtn.addEventListener('click', (e) => {
        e.stopPropagation();
    });
    
    // Assemble card
    info.appendChild(name);
    info.appendChild(price);
    info.appendChild(tagsContainer);
    info.appendChild(descriptionPreview);
    info.appendChild(wantItBtn);
    
    card.appendChild(image);
    card.appendChild(info);
    
    // Add click handler to open modal
    card.addEventListener('click', () => openModal(item));
    card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openModal(item);
        }
    });
    
    return card;
}

// Normalize image path to ensure it's correct
function normalizeImagePath(imgPath) {
    if (!imgPath) return '';
    // If path already starts with /, it's already absolute
    if (imgPath.startsWith('/')) {
        return imgPath;
    }
    // If path starts with http:// or https://, it's a full URL
    if (imgPath.startsWith('http://') || imgPath.startsWith('https://')) {
        return imgPath;
    }
    // For relative paths, ensure they're relative to the document root
    // Since HTML is at root, paths like "assets/img/file.png" should work as-is
    // But if the server requires absolute paths, add leading slash
    // Try relative first (most common case)
    return imgPath;
}

// Format price
function formatPrice(price) {
    if (price === null || price === undefined) return 'Price negotiable';
    return `$${price.toLocaleString()}`;
}

// Generate mailto link
function generateMailtoLink(itemName) {
    const subject = encodeURIComponent(`Im interested in: ${itemName}`);
    const emails = 'onyxem2@gmail.com,ziggi24@gmail.com';
    return `mailto:${emails}?subject=${subject}`;
}

// Open modal with item details
function openModal(item) {
    modalBody.innerHTML = '';
    
    // Image
    const image = document.createElement('img');
    image.src = normalizeImagePath(item.img);
    image.alt = item.name || 'Product image';
    image.className = 'modal-image';
    image.onerror = function() {
        this.classList.add('image-error');
        this.alt = 'Image not available';
    };
    
    // Name
    const name = document.createElement('h2');
    name.id = 'modal-title';
    name.className = 'modal-name';
    name.textContent = item.name || 'Unnamed Item';
    
    // Price
    const price = document.createElement('div');
    price.className = 'modal-price';
    price.textContent = formatPrice(item.price);
    
    // Tags
    const tagsContainer = document.createElement('div');
    tagsContainer.className = 'modal-tags';
    if (item.tags && Array.isArray(item.tags)) {
        item.tags.forEach(tag => {
            const tagElement = document.createElement('span');
            tagElement.className = 'modal-tag';
            tagElement.textContent = tag;
            tagsContainer.appendChild(tagElement);
        });
    }
    
    // Description
    const description = document.createElement('p');
    description.className = 'modal-description';
    description.textContent = item.description || 'No description available.';
    
    // Want it button
    const wantItBtn = document.createElement('a');
    wantItBtn.href = generateMailtoLink(item.name);
    wantItBtn.className = 'modal-want-it-btn';
    wantItBtn.textContent = 'I want it';
    wantItBtn.setAttribute('aria-label', `Contact about ${item.name}`);
    
    // Assemble modal
    modalBody.appendChild(image);
    modalBody.appendChild(name);
    modalBody.appendChild(price);
    modalBody.appendChild(tagsContainer);
    modalBody.appendChild(description);
    modalBody.appendChild(wantItBtn);
    
    // Show modal
    modalOverlay.removeAttribute('hidden');
    modalOverlay.setAttribute('aria-hidden', 'false');
    
    // Focus management
    modalClose.focus();
    
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
}

// Close modal
function closeModal() {
    modalOverlay.setAttribute('hidden', '');
    modalOverlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
}

// Setup event listeners
function setupEventListeners() {
    // Sort select change
    sortSelect.addEventListener('change', (e) => {
        currentSort = e.target.value;
        applyFiltersAndSort();
    });
    
    // Modal close button
    modalClose.addEventListener('click', closeModal);
    
    // Close modal on backdrop click
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            closeModal();
        }
    });
    
    // Close modal on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modalOverlay.hasAttribute('hidden')) {
            closeModal();
        }
    });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

