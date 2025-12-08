// Firebase client setup shared across pages
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDAnQmv9p1ZdRgwcAc_d1tqSCJcuOHGbgA",
  authDomain: "movingsale-10978.firebaseapp.com",
  projectId: "movingsale-10978",
  storageBucket: "movingsale-10978.firebasestorage.app",
  messagingSenderId: "909554336724",
  appId: "1:909554336724:web:7d92c03be6b9c5d4fa4c41",
  measurementId: "G-TSZEDHT0PS",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });
const db = getFirestore(app);

// Check if a user is an admin by reading from Firestore
async function checkIsAdmin(userId) {
  if (!userId) return false;
  try {
    const userDoc = await getDoc(doc(db, "users", userId));
    return userDoc.exists() && userDoc.data().isAdmin === true;
  } catch (error) {
    console.error("Error checking admin status:", error);
    return false;
  }
}

export {
  app,
  auth,
  provider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  db,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  checkIsAdmin,
};

