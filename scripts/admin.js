import {
  auth,
  provider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  db,
  collection,
  query,
  orderBy,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  checkIsAdmin,
} from "./firebaseClient.js";

// =====================================================
// CLOUDINARY CONFIGURATION
// =====================================================
const CLOUDINARY_CLOUD_NAME = "durxtihhe"; // UPDATE THIS with your Cloudinary cloud name
const CLOUDINARY_UPLOAD_PRESET = "movingSale"; // From your Cloudinary settings

// =====================================================
// DOM ELEMENTS
// =====================================================
const authBtn = document.getElementById("auth-btn");
const authBtnMobile = document.getElementById("auth-btn-mobile");
const profileLink = document.getElementById("profile-link");
const profileLinkMobile = document.getElementById("profile-link-mobile");
const adminMessage = document.getElementById("admin-message");

// Items elements
const addItemBtn = document.getElementById("add-item-btn");
const itemsList = document.getElementById("items-list");
const itemsLoading = document.getElementById("items-loading");
const itemsEmpty = document.getElementById("items-empty");

// Requests elements
const requestsList = document.getElementById("requests-list");
const requestsLoading = document.getElementById("requests-loading");
const requestsEmpty = document.getElementById("requests-empty");
const requestSearch = document.getElementById("request-search");

// Modal elements
const itemModal = document.getElementById("item-modal");
const itemForm = document.getElementById("item-form");
const modalTitle = document.getElementById("modal-title");
const modalClose = document.getElementById("modal-close");
const modalCancel = document.getElementById("modal-cancel");
const modalDelete = document.getElementById("modal-delete");
const modalSubmit = document.getElementById("modal-submit");
const modalSubmitText = document.getElementById("modal-submit-text");
const modalStatus = document.getElementById("modal-status");
const itemIdInput = document.getElementById("item-id");
const imagesUrlInput = document.getElementById("images-url-input");
const tagsInput = document.getElementById("tags-input");

// Image upload elements
const imageUploadArea = document.getElementById("image-upload-area");
const imageDropzone = document.getElementById("image-dropzone");
const imagesPreviewGrid = document.getElementById("images-preview-grid");
const imageUploading = document.getElementById("image-uploading");
const uploadProgress = document.getElementById("upload-progress");
const imageFileInput = document.getElementById("image-file-input");
const browseFilesBtn = document.getElementById("browse-files-btn");
const imageStatus = document.getElementById("image-status");

// Theme elements
const themeToggleDesktop = document.getElementById("theme-toggle-desktop");
const themeToggleMobile = document.getElementById("theme-toggle-mobile");

// Mobile menu elements
const hamburgerBtn = document.getElementById("hamburger-btn");
const mobileMenu = document.getElementById("mobile-menu");
const mobileMenuClose = document.getElementById("mobile-menu-close");

// =====================================================
// STATE
// =====================================================
let currentUser = null;
let items = [];
let requests = [];
let filterTerm = "";
let editingItem = null;
let currentImages = []; // Array of image URLs
let isUploading = false;
let uploadingImageIndex = -1; // Track which image is currently uploading
let allExistingTags = []; // Array of all existing tags for autocomplete

// =====================================================
// CLOUDINARY UPLOAD
// =====================================================
async function uploadToCloudinary(file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
      {
        method: "POST",
        body: formData,
      }
    );

    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message);
    }
    
    if (data.secure_url) {
      return data.secure_url;
    }
    
    throw new Error("Upload failed - no URL returned");
  } catch (error) {
    console.error("Cloudinary upload failed:", error);
    throw error;
  }
}

// =====================================================
// IMAGE UPLOAD HANDLING
// =====================================================
function initImageUpload() {
  // Browse files button
  browseFilesBtn?.addEventListener("click", () => {
    imageFileInput?.click();
  });

  // File input change - handle multiple files
  imageFileInput?.addEventListener("change", (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      handleImageFiles(files);
    }
  });

  // Drag and drop
  imageDropzone?.addEventListener("dragover", (e) => {
    e.preventDefault();
    imageDropzone.classList.add("dragover");
  });

  imageDropzone?.addEventListener("dragleave", (e) => {
    e.preventDefault();
    imageDropzone.classList.remove("dragover");
  });

  imageDropzone?.addEventListener("drop", (e) => {
    e.preventDefault();
    imageDropzone.classList.remove("dragover");
    
    const files = Array.from(e.dataTransfer?.files || []).filter(
      file => file.type.startsWith("image/")
    );
    if (files.length > 0) {
      handleImageFiles(files);
    }
  });

  // Click on dropzone to browse
  imageDropzone?.addEventListener("click", (e) => {
    if (e.target === imageDropzone || e.target.closest(".admin-image-dropzone__content")) {
      if (!e.target.closest("button")) {
        imageFileInput?.click();
      }
    }
  });
}

async function handleImageFiles(files) {
  // Filter to only image files
  const imageFiles = files.filter(file => file.type.startsWith("image/"));
  
  if (imageFiles.length === 0) {
    showImageStatus("Please select image files.", "error");
    return;
  }

  // Check how many slots are available
  const availableSlots = 8 - currentImages.length;
  if (imageFiles.length > availableSlots) {
    showImageStatus(`You can only upload ${availableSlots} more image(s). Maximum 8 images total.`, "error");
    return;
  }

  // Validate each file
  for (const file of imageFiles) {
    if (file.size > 10 * 1024 * 1024) {
      showImageStatus(`Image "${file.name}" must be less than 10MB.`, "error");
      return;
    }
  }

  // Process files sequentially
  for (let i = 0; i < imageFiles.length; i++) {
    const file = imageFiles[i];
    await handleImageFile(file);
  }
  
  // Clear file input
  imageFileInput.value = "";
}

async function handleImageFile(file) {
  // Check if we've reached the limit
  if (currentImages.length >= 8) {
    showImageStatus("Maximum of 8 images allowed.", "error");
    return;
  }

  // Show uploading state for this specific image
  const imageIndex = currentImages.length;
  uploadingImageIndex = imageIndex;
  showUploadingState();
  
  try {
    // Upload to Cloudinary
    const imageUrl = await uploadToCloudinary(file);
    
    // Add to current images array
    currentImages.push(imageUrl);
    updateImagesInput();
    
    // Add preview to grid
    addImagePreview(imageUrl, imageIndex);
    
    // Update dropzone visibility
    if (currentImages.length >= 8) {
      imageDropzone.hidden = true;
      showImageStatus("Maximum of 8 images reached.", "success");
    } else {
      showImageStatus(`Image ${currentImages.length} of 8 uploaded successfully!`, "success");
    }
  } catch (error) {
    console.error("Upload error:", error);
    showImageStatus(`Upload failed: ${error.message}`, "error");
  } finally {
    isUploading = false;
    uploadingImageIndex = -1;
    imageUploading.hidden = true;
  }
}

function showUploadingState() {
  isUploading = true;
  imageUploading.hidden = false;
  
  // Animate progress bar (fake progress since we don't have real progress)
  let progress = 0;
  const interval = setInterval(() => {
    progress += Math.random() * 15;
    if (progress > 90) {
      progress = 90;
      clearInterval(interval);
    }
    uploadProgress.style.width = `${progress}%`;
  }, 200);
  
  // Store interval to clear later
  imageUploading.dataset.interval = interval;
}

function addImagePreview(url, index) {
  // Show the preview grid if it's hidden
  if (imagesPreviewGrid.hidden) {
    imagesPreviewGrid.hidden = false;
  }
  
  // Create preview element
  const previewItem = document.createElement("div");
  previewItem.className = "admin-image-preview-item";
  previewItem.dataset.imageIndex = index;
  
  const img = document.createElement("img");
  img.src = url;
  img.alt = `Preview ${index + 1}`;
  
  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "admin-image-preview__remove";
  removeBtn.setAttribute("aria-label", `Remove image ${index + 1}`);
  removeBtn.innerHTML = '<i class="fas fa-times" aria-hidden="true"></i>';
  removeBtn.addEventListener("click", () => removeImage(index));
  
  previewItem.appendChild(img);
  previewItem.appendChild(removeBtn);
  imagesPreviewGrid.appendChild(previewItem);
}

function removeImage(index) {
  // Remove from array
  currentImages.splice(index, 1);
  
  // Update the input
  updateImagesInput();
  
  // Re-render preview grid
  renderImagePreviews();
  
  // Show dropzone if we have less than 8 images
  if (currentImages.length < 8) {
    imageDropzone.hidden = false;
  }
  
  // Update status
  if (currentImages.length === 0) {
    showImageStatus("", "");
  } else {
    showImageStatus(`${currentImages.length} image(s) uploaded.`, "success");
  }
}

function renderImagePreviews() {
  // Clear existing previews
  imagesPreviewGrid.innerHTML = "";
  
  if (currentImages.length === 0) {
    imagesPreviewGrid.hidden = true;
    return;
  }
  
  // Show grid
  imagesPreviewGrid.hidden = false;
  
  // Add preview for each image
  currentImages.forEach((url, index) => {
    addImagePreview(url, index);
  });
}

function updateImagesInput() {
  // Update hidden input with JSON array
  imagesUrlInput.value = JSON.stringify(currentImages);
}

function clearImages() {
  currentImages = [];
  imagesUrlInput.value = "";
  imagesPreviewGrid.innerHTML = "";
  imagesPreviewGrid.hidden = true;
  imageFileInput.value = "";
  imageDropzone.hidden = false;
  showImageStatus("", "");
}

function showImageStatus(message, type) {
  if (!imageStatus) return;
  
  imageStatus.textContent = message;
  imageStatus.className = "admin-field__hint";
  
  if (type === "error") {
    imageStatus.classList.add("admin-field__hint--error");
  } else if (type === "success") {
    imageStatus.classList.add("admin-field__hint--success");
  }
}

// =====================================================
// THEME MANAGEMENT
// =====================================================
function initTheme() {
  const savedTheme = localStorage.getItem("theme");
  
  if (savedTheme) {
    setTheme(savedTheme);
  } else {
    const prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
    setTheme(prefersLight ? "light" : "dark");
  }
  
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
  const isOpen = mobileMenu?.classList.contains("open");
  if (isOpen) {
    closeMobileMenu();
  } else {
    openMobileMenu();
  }
}

function openMobileMenu() {
  mobileMenu?.classList.add("open");
  hamburgerBtn?.classList.add("active");
  hamburgerBtn?.setAttribute("aria-expanded", "true");
  hamburgerBtn?.setAttribute("aria-label", "Close menu");
  document.body.style.overflow = "hidden";
}

function closeMobileMenu() {
  mobileMenu?.classList.remove("open");
  hamburgerBtn?.classList.remove("active");
  hamburgerBtn?.setAttribute("aria-expanded", "false");
  hamburgerBtn?.setAttribute("aria-label", "Open menu");
  document.body.style.overflow = "";
}

// =====================================================
// MODAL MANAGEMENT
// =====================================================
function openModal(item = null) {
  editingItem = item;
  itemForm.reset();
  modalStatus.hidden = true;
  clearImages();
  
  // Reset submit button state
  modalSubmit.disabled = false;
  
  if (item) {
    // Edit mode
    modalTitle.textContent = "Edit Item";
    modalSubmitText.textContent = "Save Changes";
    modalDelete.hidden = false;
    itemIdInput.value = item.id;
    
    // Populate form
    itemForm.name.value = item.name || "";
    itemForm.price.value = item.price ?? "";
    itemForm.tags.value = (item.tags || []).join(", ");
    itemForm.description.value = item.description || "";
    itemForm.productLink.value = item.productLink || "";
    
    // Handle images - support both old single img and new images array
    if (item.images && Array.isArray(item.images)) {
      currentImages = [...item.images];
    } else if (item.img) {
      // Legacy support: convert single img to array
      currentImages = [item.img];
    } else {
      currentImages = [];
    }
    
    updateImagesInput();
    renderImagePreviews();
    
    // Show/hide dropzone based on image count
    if (currentImages.length >= 8) {
      imageDropzone.hidden = true;
    } else {
      imageDropzone.hidden = false;
    }
  } else {
    // Add mode
    modalTitle.textContent = "Add Item";
    modalSubmitText.textContent = "Add Item";
    modalDelete.hidden = true;
    itemIdInput.value = "";
    currentImages = [];
    imageDropzone.hidden = false;
  }
  
  itemModal.classList.add("open");
  document.body.style.overflow = "hidden";
  
  // Initialize autocomplete if not already done (in case modal opens before items load)
  if (!tagsAutocompleteInitialized) {
    setTimeout(() => {
      initTagsAutocomplete();
    }, 100);
  }
  
  // Focus first input
  setTimeout(() => itemForm.name.focus(), 100);
}

function closeModal() {
  if (isUploading) {
    if (!confirm("An image is still uploading. Are you sure you want to close?")) {
      return;
    }
  }
  
  itemModal.classList.remove("open");
  document.body.style.overflow = "";
  editingItem = null;
  itemForm.reset();
  clearImages();
  modalStatus.hidden = true;
  // Reset submit button state when closing
  modalSubmit.disabled = false;
}

// =====================================================
// INITIALIZATION
// =====================================================
function init() {
  initTheme();
  initImageUpload();

  // Auth handlers
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
  themeToggleMobile?.addEventListener("click", toggleTheme);

  // Hamburger menu
  hamburgerBtn?.addEventListener("click", toggleMobileMenu);

  // Mobile menu close button
  mobileMenuClose?.addEventListener("click", closeMobileMenu);

  // Close mobile menu on nav links
  mobileMenu?.querySelectorAll(".mobile-nav-link").forEach((link) => {
    link.addEventListener("click", closeMobileMenu);
  });

  // Add item button
  addItemBtn?.addEventListener("click", () => openModal(null));

  // Modal close handlers
  modalClose?.addEventListener("click", closeModal);
  modalCancel?.addEventListener("click", closeModal);
  
  itemModal?.addEventListener("click", (e) => {
    if (e.target === itemModal) closeModal();
  });

  // Delete button
  modalDelete?.addEventListener("click", async () => {
    if (!editingItem) return;
    
    if (!confirm("Are you sure you want to delete this item?")) return;
    
    modalDelete.disabled = true;
    try {
      await deleteDoc(doc(db, "items", editingItem.id));
      closeModal();
      await loadItems();
    } catch (err) {
      console.error("Delete failed", err);
      modalStatus.textContent = "Error deleting item.";
      modalStatus.hidden = false;
      modalDelete.disabled = false;
    }
  });

  // Form submission
  itemForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    if (isUploading) {
      showImageStatus("Please wait for the image to finish uploading.", "error");
      return;
    }
    
    modalStatus.hidden = true;
    modalSubmit.disabled = true;
    
    const payload = buildItemPayload(new FormData(itemForm));
    
    try {
      if (editingItem) {
        await updateDoc(doc(db, "items", editingItem.id), payload);
        modalStatus.textContent = "✓ Item updated!";
      } else {
        await addDoc(collection(db, "items"), payload);
        modalStatus.textContent = "✓ Item added!";
      }
      modalStatus.hidden = false;
      
      // Reload items and close after brief delay
      await loadItems();
      setTimeout(closeModal, 800);
    } catch (err) {
      console.error("Save failed", err);
      modalStatus.textContent = "Error saving item.";
      modalStatus.hidden = false;
      modalSubmit.disabled = false;
    }
  });

  // Search requests
  requestSearch?.addEventListener("input", () => {
    filterTerm = requestSearch.value.toLowerCase();
    renderRequests();
  });

  // Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (itemModal?.classList.contains("open")) {
        closeModal();
      } else if (mobileMenu?.classList.contains("open")) {
        closeMobileMenu();
      }
    }
  });

  // Auth state
  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    updateAuthUI();
    
    const isAdmin = await checkIsAdmin(user?.uid);
    if (!user || !isAdmin) {
      adminMessage.textContent = "Admin access required. Your account must be marked as admin in the database.";
      adminMessage.hidden = false;
      itemsLoading.hidden = true;
      requestsLoading.hidden = true;
      return;
    }
    adminMessage.hidden = true;
    await Promise.all([loadItems(), loadRequests()]);
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
}

function buildItemPayload(formData) {
  const tags = (formData.get("tags") || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  const priceValue = (formData.get("price") || "").trim();
  
  // Parse images array from JSON string
  let images = [];
  const imagesJson = formData.get("images");
  if (imagesJson) {
    try {
      images = JSON.parse(imagesJson);
    } catch (e) {
      console.error("Failed to parse images JSON:", e);
    }
  }
  
  // Determine how to store price
  let price = null;
  if (priceValue) {
    // If exactly "0", store as number 0 (will display as "free")
    if (priceValue === "0") {
      price = 0;
    } else {
      // Store as string (will be formatted based on content)
      price = priceValue;
    }
  }
  
  return {
    name: formData.get("name") || "",
    price: price,
    images: images, // Store as array
    img: images.length > 0 ? images[0] : "", // Keep img for backward compatibility
    tags,
    description: formData.get("description") || "",
    productLink: formData.get("productLink") || "",
  };
}

// =====================================================
// ITEMS
// =====================================================
// Helper function to normalize tags (lowercase for comparison)
function normalizeTag(tag) {
  return tag.toLowerCase().trim();
}

// Helper function to format tags for display (title case)
function formatTagForDisplay(tag) {
  return tag
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

// Extract all unique tags from items
function extractAllTags(items) {
  const tagSet = new Set();
  items.forEach((item) => {
    if (item.tags && Array.isArray(item.tags)) {
      item.tags.forEach((tag) => {
        const normalized = normalizeTag(tag);
        tagSet.add(normalized);
      });
    }
  });
  return Array.from(tagSet).sort();
}

async function loadItems() {
  itemsLoading.hidden = false;
  itemsEmpty.hidden = true;
  
  try {
    const q = query(collection(db, "items"), orderBy("name"));
    const snap = await getDocs(q);
    items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    
    // Extract all existing tags for autocomplete
    allExistingTags = extractAllTags(items);
    
    renderItems();
  } catch (err) {
    console.error("Failed to load items", err);
    itemsList.innerHTML = '<p class="admin-error">Error loading items.</p>';
  } finally {
    itemsLoading.hidden = true;
  }
}

function formatPrice(price) {
  if (price === null || price === undefined) return "No price";
  
  // If price is 0 (number), display as "free"
  if (price === 0) {
    return "Free";
  }
  
  // If price is a number (not 0), format with $ and OBO
  if (typeof price === "number") {
    return `$${price.toLocaleString()} OBO`;
  }
  
  // If price is a string, check if it's a number or number range
  if (typeof price === "string") {
    const trimmed = price.trim();
    
    // Check if it's a single number or number range (e.g., "20-50", "100-429")
    const numberPattern = /^\d+$/; // Single number
    const rangePattern = /^\d+\s*-\s*\d+$/; // Number range like "20-50" or "20 - 50"
    
    if (numberPattern.test(trimmed) || rangePattern.test(trimmed)) {
      // It's a number or range, format with $ and OBO
      return `$${trimmed} OBO`;
    }
    
    // Otherwise, return as-is (custom text)
    return trimmed;
  }
  
  // Fallback for any other type
  return String(price);
}

function renderItems() {
  itemsList.innerHTML = "";
  
  if (!items.length) {
    itemsEmpty.hidden = false;
    return;
  }
  
  itemsEmpty.hidden = true;
  
  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "admin-item-row";
    row.setAttribute("tabindex", "0");
    row.setAttribute("role", "button");
    row.setAttribute("aria-label", `Edit ${item.name}`);
    
    const info = document.createElement("div");
    info.className = "admin-item-row__info";
    
    const name = document.createElement("span");
    name.className = "admin-item-row__name";
    name.textContent = item.name || "Unnamed Item";
    
    const meta = document.createElement("span");
    meta.className = "admin-item-row__meta";
    const price = formatPrice(item.price);
    const tagCount = item.tags?.length || 0;
    meta.textContent = `${price} • ${tagCount} tag${tagCount !== 1 ? 's' : ''}`;
    
    info.appendChild(name);
    info.appendChild(meta);
    
    const editBtn = document.createElement("button");
    editBtn.className = "admin-item-row__edit";
    editBtn.setAttribute("aria-label", `Edit ${item.name}`);
    editBtn.innerHTML = '<i class="fas fa-pen" aria-hidden="true"></i>';
    
    row.appendChild(info);
    row.appendChild(editBtn);
    
    // Click handlers
    const handleEdit = () => openModal(item);
    row.addEventListener("click", handleEdit);
    row.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleEdit();
      }
    });
    
    itemsList.appendChild(row);
  });
}

// =====================================================
// REQUESTS
// =====================================================
async function loadRequests() {
  requestsLoading.hidden = false;
  requestsEmpty.hidden = true;
  
  try {
    const q = query(collection(db, "requests"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    requests = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderRequests();
  } catch (err) {
    console.error("Failed to load requests", err);
    requestsList.innerHTML = '<p class="admin-error">Error loading requests.</p>';
  } finally {
    requestsLoading.hidden = true;
  }
}

// Status options for cycling
const STATUS_OPTIONS = ['new', 'contacted', 'pending', 'sold', 'declined'];
const STATUS_LABELS = {
  new: 'New',
  contacted: 'Contacted',
  pending: 'Pending',
  sold: 'Sold',
  declined: 'Declined'
};

function formatRequestDate(timestamp) {
  if (!timestamp) return null;
  
  // Handle Firestore timestamp
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();
  
  const timeStr = date.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });
  
  if (isToday) {
    return `Today at ${timeStr}`;
  } else if (isYesterday) {
    return `Yesterday at ${timeStr}`;
  } else {
    const dateStr = date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
    return `${dateStr} at ${timeStr}`;
  }
}

function renderRequests() {
  requestsList.innerHTML = "";
  
  const filtered = requests.filter((r) => {
    if (!filterTerm) return true;
    const text = `${r.itemName || ""} ${r.contactName || ""} ${r.contactInfo || ""} ${r.note || ""}`.toLowerCase();
    return text.includes(filterTerm);
  });

  if (!filtered.length) {
    if (requests.length === 0) {
      requestsEmpty.hidden = false;
    } else {
      const empty = document.createElement("p");
      empty.className = "admin-muted";
      empty.textContent = "No requests match your search.";
      requestsList.appendChild(empty);
    }
    return;
  }
  
  requestsEmpty.hidden = true;

  filtered.forEach((r) => {
    const card = document.createElement("article");
    card.className = "admin-request-card";
    
    // Determine current status
    const currentStatus = r.status || 'new';

    // Header section with item name and timestamp
    const header = document.createElement("header");
    header.className = "admin-request-card__header";
    
    const headerTop = document.createElement("div");
    headerTop.className = "admin-request-card__header-top";
    
    const title = document.createElement("h3");
    title.className = "admin-request-card__title";
    title.textContent = r.itemName || "Item";
    
    // Delete button
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "admin-request-card__delete";
    deleteBtn.setAttribute("aria-label", `Delete request for ${r.itemName || "item"}`);
    deleteBtn.innerHTML = '<i class="fas fa-trash" aria-hidden="true"></i>';
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      handleDeleteRequest(r);
    });
    
    headerTop.appendChild(title);
    headerTop.appendChild(deleteBtn);
    
    // Timestamp and status row
    const headerMeta = document.createElement("div");
    headerMeta.className = "admin-request-card__meta";
    
    // Timestamp
    const dateStr = formatRequestDate(r.createdAt);
    if (dateStr) {
      const timestamp = document.createElement("time");
      timestamp.className = "admin-request-card__timestamp";
      timestamp.innerHTML = `<i class="fas fa-clock" aria-hidden="true"></i>${dateStr}`;
      headerMeta.appendChild(timestamp);
    }
    
    // Status button (clickable to cycle through states)
    const statusBtn = document.createElement("button");
    statusBtn.className = `admin-status-btn admin-status-btn--${currentStatus}`;
    statusBtn.setAttribute("aria-label", `Status: ${STATUS_LABELS[currentStatus]}. Click to change status.`);
    statusBtn.innerHTML = `
      <span class="admin-status-btn__dot"></span>
      <span class="admin-status-btn__text">${STATUS_LABELS[currentStatus]}</span>
      <i class="fas fa-chevron-down admin-status-btn__icon" aria-hidden="true"></i>
    `;
    
    // Create status dropdown
    const statusDropdown = document.createElement("div");
    statusDropdown.className = "admin-status-dropdown";
    statusDropdown.hidden = true;
    
    STATUS_OPTIONS.forEach(status => {
      const option = document.createElement("button");
      option.className = `admin-status-dropdown__option admin-status-dropdown__option--${status}`;
      if (status === currentStatus) {
        option.classList.add('active');
      }
      option.innerHTML = `
        <span class="admin-status-btn__dot"></span>
        <span>${STATUS_LABELS[status]}</span>
      `;
      option.addEventListener("click", (e) => {
        e.stopPropagation();
        handleStatusChange(r, status);
        statusDropdown.hidden = true;
        statusBtn.setAttribute("aria-expanded", "false");
      });
      statusDropdown.appendChild(option);
    });
    
    // Status button click handler
    statusBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      // Close all other dropdowns first
      document.querySelectorAll('.admin-status-dropdown').forEach(dd => {
        if (dd !== statusDropdown) {
          dd.hidden = true;
        }
      });
      document.querySelectorAll('.admin-status-btn').forEach(btn => {
        if (btn !== statusBtn) {
          btn.setAttribute("aria-expanded", "false");
        }
      });
      
      const isOpen = !statusDropdown.hidden;
      statusDropdown.hidden = isOpen;
      statusBtn.setAttribute("aria-expanded", !isOpen);
    });
    
    const statusWrapper = document.createElement("div");
    statusWrapper.className = "admin-status-wrapper";
    statusWrapper.appendChild(statusBtn);
    statusWrapper.appendChild(statusDropdown);
    headerMeta.appendChild(statusWrapper);
    
    header.appendChild(headerTop);
    header.appendChild(headerMeta);

    // Body section with contact details
    const body = document.createElement("div");
    body.className = "admin-request-card__body";
    
    // Contact info grid
    const contactGrid = document.createElement("div");
    contactGrid.className = "admin-request-card__grid";
    
    // Name field
    const nameField = document.createElement("div");
    nameField.className = "admin-request-card__field";
    nameField.innerHTML = `
      <span class="admin-request-card__label">Name</span>
      <span class="admin-request-card__value">${escapeHtml(r.contactName) || "—"}</span>
    `;
    contactGrid.appendChild(nameField);
    
    // Contact field
    const contactField = document.createElement("div");
    contactField.className = "admin-request-card__field";
    contactField.innerHTML = `
      <span class="admin-request-card__label">Contact</span>
      <span class="admin-request-card__value">${escapeHtml(r.contactInfo) || "—"}</span>
    `;
    contactGrid.appendChild(contactField);
    
    // Email field
    const emailField = document.createElement("div");
    emailField.className = "admin-request-card__field admin-request-card__field--email";
    const emailValue = escapeHtml(r.userEmail) || "—";
    emailField.innerHTML = `
      <span class="admin-request-card__label">Email</span>
      <span class="admin-request-card__value">${emailValue !== "—" ? `<a href="mailto:${emailValue}">${emailValue}</a>` : emailValue}</span>
    `;
    contactGrid.appendChild(emailField);
    
    body.appendChild(contactGrid);
    
    // Note section (if exists)
    if (r.note) {
      const noteSection = document.createElement("div");
      noteSection.className = "admin-request-card__note";
      noteSection.innerHTML = `
        <span class="admin-request-card__label">Note</span>
        <p class="admin-request-card__note-text">${escapeHtml(r.note)}</p>
      `;
      body.appendChild(noteSection);
    }

    card.appendChild(header);
    card.appendChild(body);
    requestsList.appendChild(card);
  });
  
  // Close dropdown when clicking outside
  document.addEventListener("click", closeAllStatusDropdowns);
}

function closeAllStatusDropdowns() {
  document.querySelectorAll('.admin-status-dropdown').forEach(dd => {
    dd.hidden = true;
  });
  document.querySelectorAll('.admin-status-btn').forEach(btn => {
    btn.setAttribute("aria-expanded", "false");
  });
}

async function handleStatusChange(request, newStatus) {
  try {
    await updateDoc(doc(db, "requests", request.id), { status: newStatus });
    // Update local state
    const requestIndex = requests.findIndex(r => r.id === request.id);
    if (requestIndex !== -1) {
      requests[requestIndex].status = newStatus;
    }
    renderRequests();
  } catch (err) {
    console.error("Failed to update status", err);
    alert("Error updating status. Please try again.");
  }
}

async function handleDeleteRequest(request) {
  const itemName = request.itemName || "this item";
  const contactName = request.contactName || "Unknown";
  const confirmed = confirm(`Are you sure you want to delete the request for "${itemName}" from ${contactName}?`);
  
  if (!confirmed) {
    return;
  }
  
  try {
    await deleteDoc(doc(db, "requests", request.id));
    await loadRequests();
  } catch (err) {
    console.error("Failed to delete request", err);
    alert("Error deleting request. Please try again.");
  }
}

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
}

// =====================================================
// TAGS AUTOCOMPLETE
// =====================================================
let tagsAutocompleteInitialized = false;

function initTagsAutocomplete() {
  const tagsInput = document.getElementById("tags-input");
  const autocompleteDropdown = document.getElementById("tags-autocomplete");
  
  if (!tagsInput || !autocompleteDropdown) {
    // Elements not found yet, will try again when modal opens
    return;
  }
  
  // Prevent duplicate initialization
  if (tagsAutocompleteInitialized) {
    return;
  }
  
  tagsAutocompleteInitialized = true;
  
  let selectedIndex = -1;
  let currentSuggestions = [];
  
  // Get the current word being typed (last word after comma)
  function getCurrentWord(value) {
    const parts = value.split(",");
    return parts[parts.length - 1].trim();
  }
  
  // Get all tags already entered (before the current word)
  function getEnteredTags(value) {
    const parts = value.split(",");
    parts.pop(); // Remove the current word
    return parts.map(t => t.trim()).filter(Boolean);
  }
  
  // Filter suggestions based on current word
  function filterSuggestions(word) {
    if (!word) {
      // Show all existing tags when no input
      return allExistingTags;
    }
    
    const normalizedWord = normalizeTag(word);
    return allExistingTags
      .filter(tag => normalizeTag(tag).includes(normalizedWord))
      .slice(0, 20); // Show more results when filtering
  }
  
  // Render suggestions dropdown
  function renderSuggestions(suggestions, currentWord) {
    if (suggestions.length === 0) {
      autocompleteDropdown.hidden = true;
      return;
    }
    
    autocompleteDropdown.innerHTML = "";
    selectedIndex = -1;
    
    suggestions.forEach((tag, index) => {
      const option = document.createElement("button");
      option.type = "button";
      option.className = "tags-autocomplete-option";
      option.textContent = formatTagForDisplay(tag);
      option.dataset.tag = tag;
      
      option.addEventListener("click", () => {
        selectTag(tag, currentWord);
      });
      
      autocompleteDropdown.appendChild(option);
    });
    
    autocompleteDropdown.hidden = false;
    currentSuggestions = suggestions;
  }
  
  // Select a tag and update the input
  function selectTag(tag, currentWord) {
    const enteredTags = getEnteredTags(tagsInput.value);
    const formattedTag = formatTagForDisplay(tag);
    
    // Capitalize all previously entered tags
    const capitalizedEnteredTags = enteredTags.map(t => formatTagForDisplay(t));
    capitalizedEnteredTags.push(formattedTag);
    
    tagsInput.value = capitalizedEnteredTags.join(", ") + ", ";
    
    autocompleteDropdown.hidden = true;
    tagsInput.focus();
    
    // Move cursor to end
    tagsInput.setSelectionRange(tagsInput.value.length, tagsInput.value.length);
    
    // Show all suggestions for next tag
    setTimeout(() => {
      const suggestions = filterSuggestions("");
      renderSuggestions(suggestions, "");
    }, 10);
  }
  
  // Handle input
  tagsInput.addEventListener("input", (e) => {
    let value = e.target.value;
    
    // Auto-capitalize completed tags (everything before the last comma)
    if (value.includes(",")) {
      const parts = value.split(",");
      if (parts.length > 1) {
        const completedParts = parts.slice(0, -1);
        const lastPart = parts[parts.length - 1];
        
        // Capitalize all completed tags
        const capitalized = completedParts.map(part => {
          const trimmed = part.trim();
          return trimmed ? formatTagForDisplay(trimmed) : "";
        }).filter(Boolean);
        
        // Reconstruct value with capitalized tags
        const newValue = capitalized.join(", ") + (lastPart ? "," + lastPart : ",");
        
        if (newValue !== value) {
          const cursorPos = e.target.selectionStart;
          const cursorOffset = newValue.length - value.length;
          e.target.value = newValue;
          // Adjust cursor position
          const newCursorPos = Math.min(cursorPos + cursorOffset, newValue.length);
          e.target.setSelectionRange(newCursorPos, newCursorPos);
          value = newValue;
        }
      }
    }
    
    const currentWord = getCurrentWord(value);
    const suggestions = filterSuggestions(currentWord);
    
    renderSuggestions(suggestions, currentWord);
  });
  
  // Show dropdown on focus - show all tags
  tagsInput.addEventListener("focus", () => {
    const currentWord = getCurrentWord(tagsInput.value);
    const suggestions = filterSuggestions(currentWord);
    renderSuggestions(suggestions, currentWord);
  });
  
  // Handle keyboard navigation
  tagsInput.addEventListener("keydown", (e) => {
    if (autocompleteDropdown.hidden) return;
    
    const options = autocompleteDropdown.querySelectorAll(".tags-autocomplete-option");
    
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, options.length - 1);
        updateSelection(options);
        break;
        
      case "ArrowUp":
        e.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, -1);
        updateSelection(options);
        break;
        
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && options[selectedIndex]) {
          const tag = options[selectedIndex].dataset.tag;
          selectTag(tag, "");
        } else if (options.length > 0) {
          // Select first option if none selected
          const tag = options[0].dataset.tag;
          selectTag(tag, "");
        } else {
          // If no suggestions, just add comma and space if current word exists
          const currentWord = getCurrentWord(tagsInput.value);
          if (currentWord) {
            const enteredTags = getEnteredTags(tagsInput.value);
            enteredTags.push(formatTagForDisplay(currentWord));
            tagsInput.value = enteredTags.join(", ") + ", ";
            tagsInput.setSelectionRange(tagsInput.value.length, tagsInput.value.length);
            // Show all suggestions
            const suggestions = filterSuggestions("");
            renderSuggestions(suggestions, "");
          }
        }
        break;
        
      case "Escape":
        autocompleteDropdown.hidden = true;
        break;
        
      case "Tab":
        // Allow tab to work normally, but close dropdown
        autocompleteDropdown.hidden = true;
        break;
    }
  });
  
  // Update visual selection
  function updateSelection(options) {
    options.forEach((opt, index) => {
      opt.classList.toggle("selected", index === selectedIndex);
      if (index === selectedIndex) {
        opt.scrollIntoView({ block: "nearest" });
      }
    });
  }
  
  // Close dropdown when clicking outside
  document.addEventListener("click", (e) => {
    if (!tagsInput.contains(e.target) && !autocompleteDropdown.contains(e.target)) {
      autocompleteDropdown.hidden = true;
    }
  });
  
  // Close dropdown on blur (with delay to allow clicks)
  tagsInput.addEventListener("blur", () => {
    setTimeout(() => {
      if (document.activeElement !== tagsInput && !autocompleteDropdown.contains(document.activeElement)) {
        autocompleteDropdown.hidden = true;
      }
    }, 200);
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
