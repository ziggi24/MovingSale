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
  const priceValue = formData.get("price");
  
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
  
  return {
    name: formData.get("name") || "",
    price: priceValue ? Number(priceValue) : null,
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
async function loadItems() {
  itemsLoading.hidden = false;
  itemsEmpty.hidden = true;
  
  try {
    const q = query(collection(db, "items"), orderBy("name"));
    const snap = await getDocs(q);
    items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderItems();
  } catch (err) {
    console.error("Failed to load items", err);
    itemsList.innerHTML = '<p class="admin-error">Error loading items.</p>';
  } finally {
    itemsLoading.hidden = true;
  }
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
    const price = item.price !== null ? `$${item.price}` : "No price";
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

    const header = document.createElement("header");
    header.className = "admin-request-card__header";
    
    const title = document.createElement("h3");
    title.className = "admin-request-card__title";
    title.textContent = r.itemName || "Item";
    
    const pill = document.createElement("span");
    pill.className = `admin-status-pill admin-status-pill--${r.status || 'new'}`;
    pill.textContent = r.status || "new";
    
    header.appendChild(title);
    header.appendChild(pill);

    const body = document.createElement("div");
    body.className = "admin-request-card__body";
    
    body.innerHTML = `
      <div class="admin-request-card__row">
        <span class="admin-request-card__label">Name</span>
        <span class="admin-request-card__value">${escapeHtml(r.contactName) || "N/A"}</span>
      </div>
      <div class="admin-request-card__row">
        <span class="admin-request-card__label">Contact</span>
        <span class="admin-request-card__value">${escapeHtml(r.contactInfo) || "N/A"}</span>
      </div>
      ${r.note ? `
      <div class="admin-request-card__row admin-request-card__row--note">
        <span class="admin-request-card__label">Note</span>
        <span class="admin-request-card__value">${escapeHtml(r.note)}</span>
      </div>
      ` : ''}
      <div class="admin-request-card__row admin-request-card__row--muted">
        <span class="admin-request-card__label">Email</span>
        <span class="admin-request-card__value">${escapeHtml(r.userEmail) || "N/A"}</span>
      </div>
    `;

    card.appendChild(header);
    card.appendChild(body);
    requestsList.appendChild(card);
  });
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
// BOOTSTRAP
// =====================================================
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
