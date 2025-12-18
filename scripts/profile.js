import {
  auth,
  provider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  db,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  checkIsAdmin,
} from "./firebaseClient.js";

// =====================================================
// DOM ELEMENTS
// =====================================================
const authBtn = document.getElementById("auth-btn");
const authBtnMobile = document.getElementById("auth-btn-mobile");
const adminLink = document.getElementById("admin-link");
const adminLinkMobile = document.getElementById("admin-link-mobile");
const profileMessage = document.getElementById("profile-message");
const requestsList = document.getElementById("requests-list");
const requestsEmpty = document.getElementById("requests-empty");
const requestsLoading = document.getElementById("requests-loading");

// Theme elements
const themeToggleDesktop = document.getElementById("theme-toggle-desktop");
const themeToggleMobile = document.getElementById("theme-toggle-mobile");

// Mobile menu elements
const hamburgerBtn = document.getElementById("hamburger-btn");
const mobileMenu = document.getElementById("mobile-menu");
const mobileMenuClose = document.getElementById("mobile-menu-close");

let currentUser = null;
let isAdmin = false;

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
// INITIALIZATION
// =====================================================
function init() {
  initTheme();

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

  // Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && mobileMenu?.classList.contains("open")) {
      closeMobileMenu();
    }
  });

  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    isAdmin = await checkIsAdmin(user?.uid);
    updateAuthUI();
    if (!user) {
      showMessage("Please log in to view your requests.");
      requestsLoading.hidden = true;
      return;
    }
    requestsLoading.hidden = false;
    await loadRequests();
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

  // Show/hide admin links
  if (adminLink) adminLink.hidden = !isAdmin;
  if (adminLinkMobile) adminLinkMobile.hidden = !isAdmin;
}

function showMessage(text) {
  profileMessage.textContent = text;
  profileMessage.hidden = false;
}

async function loadRequests() {
  try {
    const q = query(
      collection(db, "requests"),
      where("userId", "==", currentUser.uid),
      orderBy("createdAt", "desc")
    );
    const snap = await getDocs(q);
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    requestsLoading.hidden = true;
    renderRequests(items);
  } catch (err) {
    console.error("Failed to load requests", err);
    showMessage("Error loading requests. Please refresh.");
    requestsLoading.hidden = true;
  }
}

function renderRequests(requests) {
  requestsList.innerHTML = "";
  if (!requests.length) {
    requestsEmpty.hidden = false;
    return;
  }
  requestsEmpty.hidden = true;
  requests.forEach((req) => {
    const card = document.createElement("article");
    card.className = "request-card";

    const heading = document.createElement("header");
    heading.className = "request-card__header";
    const title = document.createElement("h3");
    title.textContent = req.itemName || "Requested item";
    title.style.fontFamily = "var(--font-display)";
    const status = document.createElement("span");
    status.className = "pill";
    status.textContent = req.status || "new";
    heading.appendChild(title);
    heading.appendChild(status);

    const form = document.createElement("form");
    form.className = "request-edit-form stack";

    form.appendChild(createLabeledInput("Name", "contactName", req.contactName));
    form.appendChild(
      createLabeledInput("Contact info", "contactInfo", req.contactInfo)
    );
    form.appendChild(createLabeledInput("Notes", "note", req.note, true));

    const actions = document.createElement("div");
    actions.className = "actions";

    const saveBtn = document.createElement("button");
    saveBtn.type = "submit";
    saveBtn.className = "primary-btn";
    saveBtn.textContent = "Save";

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "ghost-btn";
    deleteBtn.textContent = "Delete";

    const statusText = document.createElement("span");
    statusText.className = "muted";
    statusText.hidden = true;

    actions.appendChild(saveBtn);
    actions.appendChild(deleteBtn);
    actions.appendChild(statusText);

    form.appendChild(actions);

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      saveBtn.disabled = true;
      try {
        await updateDoc(doc(db, "requests", req.id), {
          contactName: form.contactName.value.trim(),
          contactInfo: form.contactInfo.value.trim(),
          note: form.note.value.trim(),
        });
        statusText.textContent = "✓ Saved";
        statusText.hidden = false;
      } catch (error) {
        console.error("Update failed", error);
        statusText.textContent = "Error saving";
        statusText.hidden = false;
      } finally {
        saveBtn.disabled = false;
      }
    });

    deleteBtn.addEventListener("click", async () => {
      deleteBtn.disabled = true;
      try {
        await deleteDoc(doc(db, "requests", req.id));
        card.remove();
        if (!requestsList.children.length) {
          requestsEmpty.hidden = false;
        }
      } catch (error) {
        console.error("Delete failed", error);
        statusText.textContent = "Error deleting";
        statusText.hidden = false;
        deleteBtn.disabled = false;
      }
    });

    card.appendChild(heading);
    card.appendChild(form);
    requestsList.appendChild(card);
  });
}

function createLabeledInput(label, name, value = "", multiline = false) {
  const wrapper = document.createElement("label");
  wrapper.className = "field";
  wrapper.textContent = label;
  if (multiline) {
    const textarea = document.createElement("textarea");
    textarea.name = name;
    textarea.value = value || "";
    wrapper.appendChild(textarea);
  } else {
    const input = document.createElement("input");
    input.name = name;
    input.value = value || "";
    wrapper.appendChild(input);
  }
  return wrapper;
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
