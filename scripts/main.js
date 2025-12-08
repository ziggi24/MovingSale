import {
  auth,
  provider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  db,
  collection,
  getDocs,
  query,
  orderBy,
  addDoc,
  serverTimestamp,
  checkIsAdmin,
} from "./firebaseClient.js";

// =====================================================
// STATE
// =====================================================
let allItems = [];
let filteredItems = [];
let activeTags = new Set();
let currentSort = "lowest";
let currentUser = null;
let isAdmin = false;

// =====================================================
// DOM ELEMENTS
// =====================================================
const productsGrid = document.getElementById("products-grid");
const tagFiltersContainer = document.querySelector(".tag-filters");
const sortSelect = document.getElementById("sort-select");
const noResults = document.getElementById("no-results");
const clearFiltersBtn = document.getElementById("clear-filters");
const modalOverlay = document.getElementById("modal-overlay");
const modalBody = document.getElementById("modal-body");
const modalClose = document.getElementById("modal-close");

// Fullscreen viewer elements
const fullscreenViewer = document.getElementById("fullscreen-viewer");
const fullscreenViewerClose = document.getElementById("fullscreen-viewer-close");
const fullscreenViewerContainer = document.getElementById("fullscreen-viewer-container");
const fullscreenViewerPrev = document.getElementById("fullscreen-viewer-prev");
const fullscreenViewerNext = document.getElementById("fullscreen-viewer-next");

// Auth elements
const authBtn = document.getElementById("auth-btn");
const authBtnMobile = document.getElementById("auth-btn-mobile");
const profileLink = document.getElementById("profile-link");
const profileLinkMobile = document.getElementById("profile-link-mobile");
const adminLink = document.getElementById("admin-link");
const adminLinkMobile = document.getElementById("admin-link-mobile");

// Theme elements
const themeToggleDesktop = document.getElementById("theme-toggle-desktop");
const themeToggleMobile = document.getElementById("theme-toggle-mobile");

// Mobile menu elements
const hamburgerBtn = document.getElementById("hamburger-btn");
const mobileMenu = document.getElementById("mobile-menu");

// =====================================================
// THEME MANAGEMENT
// =====================================================
function initTheme() {
  // Check for saved theme preference, system preference, or default to dark
  const savedTheme = localStorage.getItem("theme");
  
  if (savedTheme) {
    setTheme(savedTheme);
  } else {
    // Check system preference
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
    
    if (prefersLight) {
      setTheme("light");
    } else {
      // Default to dark if system preference is dark or cannot be determined
      setTheme("dark");
    }
  }
  
  // Listen for system theme changes
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
    if (!localStorage.getItem("theme")) {
      setTheme(e.matches ? "dark" : "light");
    }
  });
}

function setTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);
  updateThemeToggleText(theme);
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute("data-theme");
  const newTheme = currentTheme === "dark" ? "light" : "dark";
  setTheme(newTheme);
}

function updateThemeToggleText(theme) {
  const mobileToggle = document.getElementById("theme-toggle-mobile");
  if (mobileToggle) {
    const textSpan = mobileToggle.querySelector("span");
    if (textSpan) {
      textSpan.textContent = theme === "dark" ? "Light Mode" : "Dark Mode";
    }
  }
}

// =====================================================
// MOBILE MENU
// =====================================================
function toggleMobileMenu() {
  const isOpen = mobileMenu.classList.contains("open");
  
  if (isOpen) {
    closeMobileMenu();
  } else {
    openMobileMenu();
  }
}

function openMobileMenu() {
  mobileMenu.classList.add("open");
  hamburgerBtn.classList.add("active");
  hamburgerBtn.setAttribute("aria-expanded", "true");
  hamburgerBtn.setAttribute("aria-label", "Close menu");
  document.body.style.overflow = "hidden";
}

function closeMobileMenu() {
  mobileMenu.classList.remove("open");
  hamburgerBtn.classList.remove("active");
  hamburgerBtn.setAttribute("aria-expanded", "false");
  hamburgerBtn.setAttribute("aria-label", "Open menu");
  document.body.style.overflow = "";
}

// =====================================================
// HERO GLOBE
// =====================================================
function initHeroGlobe() {
  const globeContainer = document.getElementById('hero-globe');
  if (!globeContainer || typeof Globe === 'undefined') return;

  // Denver, CO coordinates
  const denver = { lat: 39.7392, lng: -104.9903, name: 'Denver' };
  // Berlin, Germany coordinates
  const berlin = { lat: 52.5200, lng: 13.4050, name: 'Berlin' };

  // Get theme-based colors
  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  
  // Colors matching the site design
  const colors = {
    globe: isDark ? '#1a1a1a' : '#e8e5e0',
    land: isDark ? '#2d2520' : '#d4cfc5',
    arc: isDark ? '#d4a574' : '#8b6b4a',
    arcDash: isDark ? '#e5b88a' : '#725840',
    atmosphere: isDark ? 'rgba(212, 165, 116, 0.15)' : 'rgba(139, 107, 74, 0.1)',
    point: isDark ? '#d4a574' : '#8b6b4a',
  };

  const globe = Globe()
    .globeImageUrl('//unpkg.com/three-globe/example/img/earth-dark.jpg')
    .bumpImageUrl('//unpkg.com/three-globe/example/img/earth-topology.png')
    .backgroundColor('rgba(0,0,0,0)')
    .showAtmosphere(true)
    .atmosphereColor(colors.arc)
    .atmosphereAltitude(0.15)
    // Arcs: solid base arc + comet-tail gradient pulse (bright front, fading tail)
    .arcsData([
      // Solid base arc (very subtle)
      {
        startLat: denver.lat,
        startLng: denver.lng,
        endLat: berlin.lat,
        endLng: berlin.lng,
        color: `rgba(${isDark ? '212, 165, 116' : '139, 107, 74'}, 0.25)`,
        stroke: 0.25,
        dashLength: 1,
        dashGap: 0,
        animateTime: 0,
        altitude: 0.45
      },
      // Comet tail layers - longer = further back in tail, shorter = front
      // Tail end (longest, most transparent)
      {
        startLat: denver.lat,
        startLng: denver.lng,
        endLat: berlin.lat,
        endLng: berlin.lng,
        color: `rgba(${isDark ? '212, 165, 116' : '139, 107, 74'}, 0.03)`,
        stroke: 3.5,
        dashLength: 0.28,
        dashGap: 0.72,
        animateTime: 12000,
        altitude: 0.451
      },
      {
        startLat: denver.lat,
        startLng: denver.lng,
        endLat: berlin.lat,
        endLng: berlin.lng,
        color: `rgba(${isDark ? '215, 170, 120' : '145, 112, 78'}, 0.05)`,
        stroke: 3.0,
        dashLength: 0.25,
        dashGap: 0.75,
        animateTime: 12000,
        altitude: 0.451
      },
      {
        startLat: denver.lat,
        startLng: denver.lng,
        endLat: berlin.lat,
        endLng: berlin.lng,
        color: `rgba(${isDark ? '218, 175, 125' : '150, 117, 82'}, 0.07)`,
        stroke: 2.6,
        dashLength: 0.22,
        dashGap: 0.78,
        animateTime: 12000,
        altitude: 0.451
      },
      {
        startLat: denver.lat,
        startLng: denver.lng,
        endLat: berlin.lat,
        endLng: berlin.lng,
        color: `rgba(${isDark ? '222, 180, 130' : '155, 122, 86'}, 0.10)`,
        stroke: 2.2,
        dashLength: 0.19,
        dashGap: 0.81,
        animateTime: 12000,
        altitude: 0.451
      },
      {
        startLat: denver.lat,
        startLng: denver.lng,
        endLat: berlin.lat,
        endLng: berlin.lng,
        color: `rgba(${isDark ? '226, 185, 138' : '160, 127, 90'}, 0.14)`,
        stroke: 1.9,
        dashLength: 0.16,
        dashGap: 0.84,
        animateTime: 12000,
        altitude: 0.451
      },
      {
        startLat: denver.lat,
        startLng: denver.lng,
        endLat: berlin.lat,
        endLng: berlin.lng,
        color: `rgba(${isDark ? '230, 190, 145' : '165, 132, 95'}, 0.19)`,
        stroke: 1.6,
        dashLength: 0.13,
        dashGap: 0.87,
        animateTime: 12000,
        altitude: 0.451
      },
      {
        startLat: denver.lat,
        startLng: denver.lng,
        endLat: berlin.lat,
        endLng: berlin.lng,
        color: `rgba(${isDark ? '235, 198, 155' : '172, 140, 102'}, 0.26)`,
        stroke: 1.3,
        dashLength: 0.10,
        dashGap: 0.90,
        animateTime: 12000,
        altitude: 0.451
      },
      {
        startLat: denver.lat,
        startLng: denver.lng,
        endLat: berlin.lat,
        endLng: berlin.lng,
        color: `rgba(${isDark ? '240, 208, 168' : '180, 150, 112'}, 0.38)`,
        stroke: 1.0,
        dashLength: 0.07,
        dashGap: 0.93,
        animateTime: 12000,
        altitude: 0.451
      },
      {
        startLat: denver.lat,
        startLng: denver.lng,
        endLat: berlin.lat,
        endLng: berlin.lng,
        color: `rgba(${isDark ? '248, 222, 188' : '190, 162, 125'}, 0.55)`,
        stroke: 0.7,
        dashLength: 0.05,
        dashGap: 0.95,
        animateTime: 12000,
        altitude: 0.451
      },
      // Bright front (shortest, brightest)
      {
        startLat: denver.lat,
        startLng: denver.lng,
        endLat: berlin.lat,
        endLng: berlin.lng,
        color: `rgba(${isDark ? '255, 242, 220' : '210, 180, 145'}, 0.9)`,
        stroke: 0.4,
        dashLength: 0.03,
        dashGap: 0.97,
        animateTime: 12000,
        altitude: 0.451
      }
    ])
    .arcColor('color')
    .arcDashLength('dashLength')
    .arcDashGap('dashGap')
    .arcDashAnimateTime('animateTime')
    .arcStroke('stroke')
    .arcAltitude('altitude')
    // Point markers for cities (small glowing dots)
    .pointsData([denver, berlin])
    .pointColor(() => colors.point)
    .pointAltitude(0.005)
    .pointRadius(0.6)
    .pointsMerge(true)
    (globeContainer);

  // Camera animation: start at Denver, travel along arc to view of both cities
  const isMobile = window.innerWidth < 768;
  const altitudeStart = isMobile ? 1.8 : 1.4;
  const altitudeEnd = isMobile ? 2.8 : 2.2;
  
  // Start camera at Denver
  globe.pointOfView({ lat: denver.lat, lng: denver.lng, altitude: altitudeStart }, 0);
  
  // After a brief pause, animate camera along the journey towards Berlin
  setTimeout(() => {
    // First move to mid-Atlantic view (showing the arc)
    globe.pointOfView({ lat: 48, lng: -30, altitude: altitudeEnd }, 4000);
  }, 1500);

  // Subtle auto-rotation
  globe.controls().autoRotate = true;
  globe.controls().autoRotateSpeed = 0.3;
  globe.controls().enableZoom = false;
  globe.controls().enablePan = false;
  globe.controls().enableRotate = false;

  // Custom globe material for darker appearance
  globe.onGlobeReady(() => {
    const globeMaterial = globe.globeMaterial();
    globeMaterial.bumpScale = 3;
    
    // Make globe darker
    if (isDark) {
      globeMaterial.color.setHex(0x1a1510);
      globeMaterial.emissive.setHex(0x0a0805);
      globeMaterial.emissiveIntensity = 0.1;
    } else {
      globeMaterial.color.setHex(0xe8e5e0);
    }
  });

  // Update globe colors when theme changes
  const themeObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === 'data-theme') {
        // Refresh globe with new colors
        const newIsDark = document.documentElement.getAttribute('data-theme') !== 'light';
        const newColors = {
          arc: newIsDark ? '#d4a574' : '#8b6b4a',
          point: newIsDark ? '#d4a574' : '#8b6b4a',
        };
        
        globe.arcColor(() => [newColors.arc, newColors.arc]);
        globe.pointColor(() => newColors.point);
        globe.atmosphereColor(newColors.arc);
        
        const globeMaterial = globe.globeMaterial();
        if (newIsDark) {
          globeMaterial.color.setHex(0x1a1510);
          globeMaterial.emissive.setHex(0x0a0805);
        } else {
          globeMaterial.color.setHex(0xe8e5e0);
          globeMaterial.emissive.setHex(0x000000);
        }
      }
    });
  });

  themeObserver.observe(document.documentElement, { attributes: true });

  // Handle window resize
  const resizeGlobe = () => {
    globe.width(globeContainer.offsetWidth);
    globe.height(globeContainer.offsetHeight);
  };

  window.addEventListener('resize', resizeGlobe);
  
  // Pause animation when not visible for performance
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        globe.resumeAnimation();
      } else {
        globe.pauseAnimation();
      }
    });
  }, { threshold: 0 });
  
  observer.observe(globeContainer);

  return globe;
}

// =====================================================
// INITIALIZATION
// =====================================================
async function init() {
  initTheme();
  initHeroGlobe();
  bindGlobalEvents();
  watchAuth();
  await loadItems();
  setupEventListeners();
}

function bindGlobalEvents() {
  // Auth buttons
  const handleAuthClick = () => {
    if (currentUser) {
      signOut(auth);
    } else {
      signInWithPopup(auth, provider).catch((err) =>
        console.error("Login failed", err)
      );
    }
    closeMobileMenu();
  };

  authBtn?.addEventListener("click", handleAuthClick);
  authBtnMobile?.addEventListener("click", handleAuthClick);

  // Theme toggles
  themeToggleDesktop?.addEventListener("click", toggleTheme);
  themeToggleMobile?.addEventListener("click", () => {
    toggleTheme();
  });

  // Hamburger menu
  hamburgerBtn?.addEventListener("click", toggleMobileMenu);

  // Close mobile menu when clicking nav links
  mobileMenu?.querySelectorAll(".mobile-nav-link").forEach((link) => {
    link.addEventListener("click", closeMobileMenu);
  });

  // Close mobile menu on escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && mobileMenu?.classList.contains("open")) {
      closeMobileMenu();
    }
  });
}

function watchAuth() {
  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    isAdmin = await checkIsAdmin(user?.uid);
    updateAuthUI();
  });
}

function updateAuthUI() {
  const updateButton = (btn, isMobile = false) => {
    if (!btn) return;
    
    if (currentUser) {
      if (isMobile) {
        btn.innerHTML = `<i class="fas fa-sign-out-alt" aria-hidden="true"></i><span>Logout</span>`;
      } else {
        btn.innerHTML = `<span class="auth-text">Logout</span><i class="fas fa-sign-out-alt auth-icon" aria-hidden="true"></i>`;
      }
    } else {
      if (isMobile) {
        btn.innerHTML = `<i class="fas fa-sign-in-alt" aria-hidden="true"></i><span>Login with Google</span>`;
      } else {
        btn.innerHTML = `<span class="auth-text">Login</span><i class="fas fa-sign-in-alt auth-icon" aria-hidden="true"></i>`;
      }
    }
  };

  updateButton(authBtn, false);
  updateButton(authBtnMobile, true);

  // Show/hide profile links
  if (profileLink) profileLink.hidden = !currentUser;
  if (profileLinkMobile) profileLinkMobile.hidden = !currentUser;

  // Show/hide admin links
  if (adminLink) adminLink.hidden = !isAdmin;
  if (adminLinkMobile) adminLinkMobile.hidden = !isAdmin;
}

// =====================================================
// DATA LOADING
// =====================================================
async function loadItems() {
  try {
    const q = query(collection(db, "items"), orderBy("name"));
    const snapshot = await getDocs(q);
    allItems = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    const uniqueTags = extractUniqueTags(allItems);
    renderTagFilters(uniqueTags);
    filteredItems = [...allItems];
    applyFiltersAndSort();
  } catch (error) {
    console.error("Error loading items:", error);
    productsGrid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 3rem;">
        <p style="color: var(--color-text-muted);">Error loading items. Please refresh the page.</p>
      </div>
    `;
  }
}

function extractUniqueTags(items) {
  const tagSet = new Set();
  items.forEach((item) => {
    if (item.tags && Array.isArray(item.tags)) {
      item.tags.forEach((tag) => tagSet.add(tag));
    }
  });
  return Array.from(tagSet).sort();
}

// =====================================================
// FILTERS & SORTING
// =====================================================
function renderTagFilters(tags) {
  tagFiltersContainer.innerHTML = "";

  tags.forEach((tag) => {
    const button = document.createElement("button");
    button.className = "tag-filter-btn";
    button.textContent = tag;
    button.setAttribute("aria-pressed", "false");
    button.setAttribute("data-tag", tag);
    button.addEventListener("click", () => toggleTagFilter(tag, button));
    tagFiltersContainer.appendChild(button);
  });
}

function toggleTagFilter(tag, button) {
  if (activeTags.has(tag)) {
    activeTags.delete(tag);
    button.classList.remove("active");
    button.setAttribute("aria-pressed", "false");
  } else {
    activeTags.add(tag);
    button.classList.add("active");
    button.setAttribute("aria-pressed", "true");
  }
  applyFiltersAndSort();
}

function clearAllFilters() {
  activeTags.clear();
  document.querySelectorAll(".tag-filter-btn").forEach((btn) => {
    btn.classList.remove("active");
    btn.setAttribute("aria-pressed", "false");
  });
  applyFiltersAndSort();
}

function applyFiltersAndSort() {
  if (activeTags.size === 0) {
    filteredItems = [...allItems];
  } else {
    filteredItems = allItems.filter((item) => {
      if (!item.tags || !Array.isArray(item.tags)) return false;
      return item.tags.some((tag) => activeTags.has(tag));
    });
  }

  sortItems();
  renderItems();

  if (filteredItems.length === 0) {
    noResults.removeAttribute("hidden");
    productsGrid.setAttribute("hidden", "");
  } else {
    noResults.setAttribute("hidden", "");
    productsGrid.removeAttribute("hidden");
  }
}

function sortItems() {
  switch (currentSort) {
    case "lowest":
      filteredItems.sort((a, b) => (a.price || 0) - (b.price || 0));
      break;
    case "highest":
      filteredItems.sort((a, b) => (b.price || 0) - (a.price || 0));
      break;
    case "alphabetical":
      filteredItems.sort((a, b) => {
        const nameA = (a.name || "").toLowerCase();
        const nameB = (b.name || "").toLowerCase();
        return nameA.localeCompare(nameB);
      });
      break;
  }
}

// =====================================================
// RENDERING
// =====================================================
function renderItems() {
  productsGrid.innerHTML = "";

  filteredItems.forEach((item, index) => {
    const card = createProductCard(item, index);
    productsGrid.appendChild(card);
  });
}

function createProductCard(item, index) {
  const card = document.createElement("article");
  card.className = "product-card";
  card.setAttribute("role", "listitem");
  card.setAttribute("tabindex", "0");
  card.setAttribute("aria-label", `Product: ${item.name}`);
  card.style.animationDelay = `${Math.min(index * 0.05, 0.4)}s`;

  // Get images array - support both old img and new images array
  const images = getItemImages(item);

  // Image wrapper for proper aspect ratio
  const imageWrapper = document.createElement("div");
  imageWrapper.className = "product-image-wrapper";

  // Show first image
  const image = document.createElement("img");
  image.src = normalizeImagePath(images[0] || "");
  image.alt = item.name || "Product image";
  image.className = "product-image";
  image.loading = "lazy";
  image.onerror = function () {
    this.classList.add("image-error");
    this.alt = "Image not available";
    // Add placeholder icon
    const placeholder = document.createElement("div");
    placeholder.className = "product-image-placeholder";
    placeholder.innerHTML = '<i class="fas fa-image" aria-hidden="true"></i>';
    imageWrapper.appendChild(placeholder);
    this.style.opacity = "0";
  };

  imageWrapper.appendChild(image);

  // Add carousel indicator if multiple images
  if (images.length > 1) {
    const indicator = document.createElement("div");
    indicator.className = "product-image-indicator";
    indicator.innerHTML = `<i class="fas fa-images" aria-hidden="true"></i><span>${images.length}</span>`;
    imageWrapper.appendChild(indicator);
  }

  const info = document.createElement("div");
  info.className = "product-info";

  const name = document.createElement("h3");
  name.className = "product-name";
  name.textContent = item.name || "Unnamed Item";

  const price = document.createElement("div");
  price.className = "product-price";
  price.textContent = formatPrice(item.price);

  const tagsContainer = document.createElement("div");
  tagsContainer.className = "product-tags";
  if (item.tags && Array.isArray(item.tags)) {
    item.tags.forEach((tag) => {
      const tagElement = document.createElement("span");
      tagElement.className = "product-tag";
      tagElement.textContent = tag;
      tagsContainer.appendChild(tagElement);
    });
  }

  const descriptionPreview = document.createElement("p");
  descriptionPreview.className = "product-description-preview";
  descriptionPreview.textContent =
    item.description || "No description available.";

  const requestBtn = document.createElement("button");
  requestBtn.type = "button";
  requestBtn.className = "request-btn";
  requestBtn.textContent = "Request Item";
  requestBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    openModal(item);
  });

  info.appendChild(name);
  info.appendChild(price);
  info.appendChild(tagsContainer);
  info.appendChild(descriptionPreview);
  info.appendChild(requestBtn);

  card.appendChild(imageWrapper);
  card.appendChild(info);

  card.addEventListener("click", () => openModal(item));
  card.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openModal(item);
    }
  });

  return card;
}

function getItemImages(item) {
  // Support both new images array and legacy img field
  if (item.images && Array.isArray(item.images) && item.images.length > 0) {
    return item.images;
  } else if (item.img) {
    return [item.img];
  }
  return [];
}

function normalizeImagePath(imgPath) {
  if (!imgPath) return "";
  if (imgPath.startsWith("/") || imgPath.startsWith("http")) {
    return imgPath;
  }
  return imgPath;
}

function formatPrice(price) {
  if (price === null || price === undefined) return "Price negotiable";
  return `$${price.toLocaleString()}`;
}

// =====================================================
// FULLSCREEN IMAGE VIEWER
// =====================================================
let fullscreenViewerImages = [];
let fullscreenViewerCurrentIndex = 0;
let fullscreenViewerAltText = "Product image";

function openFullscreenViewer(images, startIndex = 0, altText = "Product image") {
  fullscreenViewerImages = images;
  fullscreenViewerCurrentIndex = startIndex;
  fullscreenViewerAltText = altText;
  
  // Show/hide navigation buttons based on image count
  if (images.length > 1) {
    fullscreenViewerPrev.hidden = false;
    fullscreenViewerNext.hidden = false;
  } else {
    fullscreenViewerPrev.hidden = true;
    fullscreenViewerNext.hidden = true;
  }
  
  // Show the viewer
  fullscreenViewer.hidden = false;
  document.body.style.overflow = "hidden";
  
  // Display the image
  showFullscreenImage(startIndex);
  
  // Focus the close button for accessibility
  fullscreenViewerClose.focus();
}

function closeFullscreenViewer() {
  fullscreenViewer.hidden = true;
  document.body.style.overflow = "";
  fullscreenViewerContainer.innerHTML = "";
  fullscreenViewerImages = [];
  fullscreenViewerCurrentIndex = 0;
  fullscreenViewerAltText = "Product image";
}

function showFullscreenImage(index) {
  fullscreenViewerContainer.innerHTML = "";
  
  const img = document.createElement("img");
  img.src = normalizeImagePath(fullscreenViewerImages[index]);
  img.alt = `${fullscreenViewerAltText} - Image ${index + 1}`;
  img.className = "fullscreen-viewer__image";
  img.onerror = function () {
    this.style.display = "none";
    const placeholder = document.createElement("div");
    placeholder.className = "fullscreen-viewer__placeholder";
    placeholder.innerHTML = '<i class="fas fa-image" aria-hidden="true"></i><p>Image not available</p>';
    fullscreenViewerContainer.appendChild(placeholder);
  };
  
  fullscreenViewerContainer.appendChild(img);
  
  // Update navigation button states
  fullscreenViewerPrev.disabled = index === 0;
  fullscreenViewerNext.disabled = index === fullscreenViewerImages.length - 1;
  
  fullscreenViewerCurrentIndex = index;
}

function nextFullscreenImage() {
  if (fullscreenViewerCurrentIndex < fullscreenViewerImages.length - 1) {
    showFullscreenImage(fullscreenViewerCurrentIndex + 1);
  }
}

function prevFullscreenImage() {
  if (fullscreenViewerCurrentIndex > 0) {
    showFullscreenImage(fullscreenViewerCurrentIndex - 1);
  }
}

// =====================================================
// IMAGE CAROUSEL
// =====================================================
function createImageCarousel(images, altText, item = null) {
  const carousel = document.createElement("div");
  carousel.className = "image-carousel";
  
  const carouselContainer = document.createElement("div");
  carouselContainer.className = "image-carousel__container";
  
  // Create image elements
  const imageElements = images.map((imgSrc, index) => {
    const imgWrapper = document.createElement("div");
    imgWrapper.className = "image-carousel__slide";
    if (index === 0) imgWrapper.classList.add("active");
    
    const img = document.createElement("img");
    img.src = normalizeImagePath(imgSrc);
    img.alt = `${altText} - Image ${index + 1}`;
    img.className = "image-carousel__image";
    img.style.cursor = "pointer";
    img.onerror = function () {
      this.classList.add("image-error");
      this.alt = "Image not available";
      this.style.opacity = "0";
      this.style.cursor = "default";
      const placeholder = document.createElement("div");
      placeholder.className = "product-image-placeholder";
      placeholder.innerHTML = '<i class="fas fa-image" aria-hidden="true"></i>';
      imgWrapper.appendChild(placeholder);
    };
    
    // Make image clickable to open fullscreen
    img.addEventListener("click", () => {
      openFullscreenViewer(images, index, altText);
    });
    
    imgWrapper.appendChild(img);
    return imgWrapper;
  });
  
  imageElements.forEach(el => carouselContainer.appendChild(el));
  
  // Navigation arrows
  const prevBtn = document.createElement("button");
  prevBtn.className = "image-carousel__nav image-carousel__nav--prev";
  prevBtn.setAttribute("aria-label", "Previous image");
  prevBtn.innerHTML = '<i class="fas fa-chevron-left" aria-hidden="true"></i>';
  
  const nextBtn = document.createElement("button");
  nextBtn.className = "image-carousel__nav image-carousel__nav--next";
  nextBtn.setAttribute("aria-label", "Next image");
  nextBtn.innerHTML = '<i class="fas fa-chevron-right" aria-hidden="true"></i>';
  
  // Pagination dots
  const pagination = document.createElement("div");
  pagination.className = "image-carousel__pagination";
  images.forEach((_, index) => {
    const dot = document.createElement("button");
    dot.className = "image-carousel__dot";
    if (index === 0) dot.classList.add("active");
    dot.setAttribute("aria-label", `Go to image ${index + 1}`);
    dot.setAttribute("data-index", index);
    pagination.appendChild(dot);
  });
  
  // Carousel state
  let currentIndex = 0;
  
  // Navigation functions
  const showSlide = (index) => {
    // Update slides
    imageElements.forEach((slide, i) => {
      slide.classList.toggle("active", i === index);
    });
    
    // Update dots
    pagination.querySelectorAll(".image-carousel__dot").forEach((dot, i) => {
      dot.classList.toggle("active", i === index);
    });
    
    // Update button states
    prevBtn.disabled = index === 0;
    nextBtn.disabled = index === images.length - 1;
    
    currentIndex = index;
  };
  
  const nextSlide = () => {
    if (currentIndex < images.length - 1) {
      showSlide(currentIndex + 1);
    }
  };
  
  const prevSlide = () => {
    if (currentIndex > 0) {
      showSlide(currentIndex - 1);
    }
  };
  
  // Event listeners
  nextBtn.addEventListener("click", nextSlide);
  prevBtn.addEventListener("click", prevSlide);
  
  pagination.querySelectorAll(".image-carousel__dot").forEach((dot) => {
    dot.addEventListener("click", () => {
      const index = parseInt(dot.getAttribute("data-index"));
      showSlide(index);
    });
  });
  
  // Keyboard navigation
  carousel.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      prevSlide();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      nextSlide();
    }
  });
  
  // Swipe support for touch devices
  let touchStartX = 0;
  let touchEndX = 0;
  
  carouselContainer.addEventListener("touchstart", (e) => {
    touchStartX = e.changedTouches[0].screenX;
  });
  
  carouselContainer.addEventListener("touchend", (e) => {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
  });
  
  function handleSwipe() {
    const swipeThreshold = 50;
    const diff = touchStartX - touchEndX;
    
    if (Math.abs(diff) > swipeThreshold) {
      if (diff > 0) {
        nextSlide();
      } else {
        prevSlide();
      }
    }
  }
  
  // Assemble carousel
  carousel.appendChild(carouselContainer);
  carousel.appendChild(prevBtn);
  carousel.appendChild(nextBtn);
  carousel.appendChild(pagination);
  carousel.setAttribute("tabindex", "0");
  
  // Initialize
  showSlide(0);
  
  return carousel;
}

// =====================================================
// MODAL
// =====================================================
function openModal(item) {
  modalBody.innerHTML = "";

  // Get images array
  const images = getItemImages(item);

  // Image wrapper with carousel support
  const imageWrapper = document.createElement("div");
  imageWrapper.className = "modal-image-wrapper";

  if (images.length > 1) {
    // Create carousel for multiple images
    const carousel = createImageCarousel(images, item.name || "Product image", item);
    imageWrapper.appendChild(carousel);
  } else {
    // Single image (no carousel needed)
    const image = document.createElement("img");
    image.src = normalizeImagePath(images[0] || "");
    image.alt = item.name || "Product image";
    image.className = "modal-image";
    image.style.cursor = "pointer";
    image.onerror = function () {
      this.classList.add("image-error");
      this.alt = "Image not available";
      this.style.opacity = "0";
      this.style.cursor = "default";
      const placeholder = document.createElement("div");
      placeholder.className = "product-image-placeholder";
      placeholder.innerHTML = '<i class="fas fa-image" aria-hidden="true"></i>';
      imageWrapper.appendChild(placeholder);
    };
    // Make image clickable to open fullscreen
    if (images[0]) {
      image.addEventListener("click", () => openFullscreenViewer(images, 0, item.name || "Product image"));
    }
    imageWrapper.appendChild(image);
  }

  const name = document.createElement("h2");
  name.id = "modal-title";
  name.className = "modal-name";
  name.textContent = item.name || "Unnamed Item";

  const price = document.createElement("div");
  price.className = "modal-price";
  price.textContent = formatPrice(item.price);

  const tagsContainer = document.createElement("div");
  tagsContainer.className = "modal-tags";
  if (item.tags && Array.isArray(item.tags)) {
    item.tags.forEach((tag) => {
      const tagElement = document.createElement("span");
      tagElement.className = "modal-tag";
      tagElement.textContent = tag;
      tagsContainer.appendChild(tagElement);
    });
  }

  const description = document.createElement("p");
  description.className = "modal-description";
  description.textContent = item.description || "No description available.";

  // Product link (if available)
  let productLinkElement = null;
  if (item.productLink) {
    productLinkElement = document.createElement("a");
    productLinkElement.href = item.productLink;
    productLinkElement.target = "_blank";
    productLinkElement.rel = "noopener noreferrer";
    productLinkElement.className = "modal-product-link";
    productLinkElement.innerHTML = '<i class="fas fa-link" aria-hidden="true"></i><span>Original Product</span>';
  }

  const requestSection = document.createElement("div");
  requestSection.className = "request-section";

  if (!currentUser) {
    const loginPrompt = document.createElement("p");
    loginPrompt.className = "request-login";
    loginPrompt.textContent = "Please login to request this item.";
    const loginBtn = document.createElement("button");
    loginBtn.type = "button";
    loginBtn.className = "primary-btn";
    loginBtn.innerHTML = '<i class="fab fa-google" style="margin-right: 0.5rem;"></i>Login with Google';
    loginBtn.addEventListener("click", () => authBtn.click());
    requestSection.appendChild(loginPrompt);
    requestSection.appendChild(loginBtn);
  } else {
    const form = buildRequestForm(item);
    requestSection.appendChild(form);
  }

  modalBody.appendChild(imageWrapper);
  modalBody.appendChild(name);
  modalBody.appendChild(price);
  modalBody.appendChild(tagsContainer);
  modalBody.appendChild(description);
  if (productLinkElement) {
    modalBody.appendChild(productLinkElement);
  }
  modalBody.appendChild(requestSection);

  modalOverlay.classList.add("open");
  modalOverlay.setAttribute("aria-hidden", "false");
  modalClose.focus();
  document.body.style.overflow = "hidden";
}

function buildRequestForm(item) {
  const form = document.createElement("form");
  form.className = "request-form";

  const nameField = createInputField(
    "Your name",
    "request-name",
    currentUser?.displayName || ""
  );
  const contactField = createInputField(
    "Contact info (email or phone)",
    "request-contact",
    currentUser?.email || ""
  );
  const noteField = document.createElement("label");
  noteField.className = "field";
  noteField.textContent = "Notes (optional)";
  const textarea = document.createElement("textarea");
  textarea.id = "request-note";
  textarea.name = "request-note";
  textarea.placeholder = "When are you available? Any questions?";
  noteField.appendChild(textarea);

  const status = document.createElement("p");
  status.className = "request-status";
  status.hidden = true;

  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "primary-btn";
  submit.textContent = "Submit Request";

  form.appendChild(nameField);
  form.appendChild(contactField);
  form.appendChild(noteField);
  form.appendChild(submit);
  form.appendChild(status);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    submit.disabled = true;
    submit.textContent = "Submitting...";
    status.hidden = true;
    try {
      await addDoc(collection(db, "requests"), {
        userId: currentUser.uid,
        userEmail: currentUser.email,
        userName: currentUser.displayName || "",
        contactName: form.querySelector("#request-name").value.trim(),
        contactInfo: form.querySelector("#request-contact").value.trim(),
        note: textarea.value.trim(),
        itemId: item.id,
        itemName: item.name,
        status: "new",
        createdAt: serverTimestamp(),
      });
      status.textContent = "✓ Request submitted successfully!";
      status.hidden = false;
      form.reset();
      submit.textContent = "Submitted";
    } catch (err) {
      console.error("Failed to submit request", err);
      status.textContent = "Error submitting request. Please try again.";
      status.hidden = false;
      submit.disabled = false;
      submit.textContent = "Submit Request";
    }
  });

  return form;
}

function createInputField(labelText, id, value = "") {
  const wrapper = document.createElement("label");
  wrapper.className = "field";
  wrapper.setAttribute("for", id);
  wrapper.textContent = labelText;
  const input = document.createElement("input");
  input.id = id;
  input.name = id;
  input.value = value;
  input.required = true;
  wrapper.appendChild(input);
  return wrapper;
}

function closeModal() {
  modalOverlay.classList.remove("open");
  modalOverlay.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

// =====================================================
// EVENT LISTENERS
// =====================================================
function setupEventListeners() {
  sortSelect?.addEventListener("change", (e) => {
    currentSort = e.target.value;
    applyFiltersAndSort();
  });

  modalClose?.addEventListener("click", closeModal);

  // Fullscreen viewer event listeners
  fullscreenViewerClose?.addEventListener("click", closeFullscreenViewer);
  fullscreenViewerPrev?.addEventListener("click", prevFullscreenImage);
  fullscreenViewerNext?.addEventListener("click", nextFullscreenImage);

  // Close fullscreen viewer when clicking outside the image (but not on buttons)
  fullscreenViewer?.addEventListener("click", (e) => {
    if (e.target === fullscreenViewer || (e.target === fullscreenViewerContainer && !e.target.closest("img"))) {
      closeFullscreenViewer();
    }
  });

  modalOverlay?.addEventListener("click", (e) => {
    if (e.target === modalOverlay) {
      closeModal();
    }
  });

  clearFiltersBtn?.addEventListener("click", clearAllFilters);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (!fullscreenViewer.hidden) {
        closeFullscreenViewer();
      } else if (modalOverlay?.classList.contains("open")) {
        closeModal();
      }
    } else if (e.key === "ArrowLeft" && !fullscreenViewer.hidden && fullscreenViewerImages.length > 1) {
      e.preventDefault();
      prevFullscreenImage();
    } else if (e.key === "ArrowRight" && !fullscreenViewer.hidden && fullscreenViewerImages.length > 1) {
      e.preventDefault();
      nextFullscreenImage();
    }
  });
}

// =====================================================
// BOOTSTRAP
// =====================================================
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
