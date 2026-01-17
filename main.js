// ---------- Configuration (YOU PROVIDED) ----------
const firebaseConfig = {
  apiKey: "AIzaSyAnqlWmB3YL4lqoy_YeE4mD3ELk-5sUW8Q",
  authDomain: "muktadir-s-personal-blog.firebaseapp.com",
  projectId: "muktadir-s-personal-blog",
  storageBucket: "muktadir-s-personal-blog.firebasestorage.app",
  messagingSenderId: "868249534030",
  appId: "1:868249534030:web:4b790381ba8491fb998d1f",
  measurementId: "G-CY0GW8NP1K",
};

// ---------- Init Firebase ----------
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Local state
let editingDocId = null;
let editingIsDraft = false;

// ----------------- Helpers -----------------
function escapeHtml(str) {
  if (str === undefined || str === null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function toggleDateTimeInputs() {
  const checkbox = document.getElementById("useCurrentDateTime");
  const customInputs = document.getElementById("customDateTimeInputs");

  if (checkbox.checked) {
    customInputs.classList.add("hidden");
  } else {
    customInputs.classList.remove("hidden");
    const now = new Date();
    document.getElementById("customDate").value = now
      .toISOString()
      .split("T")[0];
    document.getElementById("customTime").value = now
      .toTimeString()
      .slice(0, 5);
  }
}

function closeEditModal() {
  document.getElementById("editModal").classList.add("hidden");
  editingDocId = null;
  editingIsDraft = false;
  document.getElementById("editTitle").value = "";
  document.getElementById("editContent").value = "";
  // reset custom fields
  const cd = document.getElementById("customDate");
  const ct = document.getElementById("customTime");
  if (cd) cd.value = "";
  if (ct) ct.value = "";
  document.getElementById("useCurrentDateTime").checked = true;
  document.getElementById("customDateTimeInputs").classList.add("hidden");
}

// ----------------- Auth helpers -----------------
function checkUserId() {
  const email = document.getElementById("userId").value.trim();
  if (!email) {
    alert("ইমেইল লিখুন!");
    return;
  }
  document.getElementById("userIdStep").classList.add("hidden");
  document.getElementById("passwordStep").classList.remove("hidden");
  document.getElementById("adminPassword").focus();
}

function goBackToUserId() {
  document.getElementById("userIdStep").classList.remove("hidden");
  document.getElementById("passwordStep").classList.add("hidden");
  document.getElementById("adminPassword").value = "";
}

function checkPassword() {
  const email = document.getElementById("userId").value.trim();
  const password = document.getElementById("adminPassword").value;
  if (!email || !password) {
    alert("ইমেইল ও পাসওয়ার্ড দরকার।");
    return;
  }
  auth
    .signInWithEmailAndPassword(email, password)
    .then(() => {
      // success handled by onAuthStateChanged
    })
    .catch((err) => {
      alert("লগইন ব্যর্থ: " + err.message);
    });
}

function logout() {
  auth.signOut().then(() => {
    // signed out
  });
}

// Auth state change
auth.onAuthStateChanged((user) => {
  if (window.location.hash === "#admin") {
    if (user) {
      showAdminDashboard();
    } else {
      showAdminLogin();
    }
  } else {
    showPublicView();
  }
});

// View switches
function showAdminLogin() {
  document.getElementById("adminLoginPage").classList.remove("hidden");
  document.getElementById("publicView").classList.add("hidden");
  document.getElementById("adminDashboard").classList.add("hidden");
  document.getElementById("userId").focus();
}

function showPublicView() {
  document.getElementById("adminLoginPage").classList.add("hidden");
  document.getElementById("publicView").classList.remove("hidden");
  document.getElementById("adminDashboard").classList.add("hidden");
  window.location.hash = "";
  loadPosts();
}

function showAdminDashboard() {
  document.getElementById("adminLoginPage").classList.add("hidden");
  document.getElementById("publicView").classList.add("hidden");
  document.getElementById("adminDashboard").classList.remove("hidden");
  window.location.hash = "admin";
  showTab("newPost");
  loadAdminPosts();
  loadDrafts();
}

function goToPublicView() {
  showPublicView();
}

//Bangla time conversiton
function convertToBengaliTime(timeValue) {
  // timeValue = "14:30" বা "08:05"
  const [hourStr, minute] = timeValue.split(":");
  let hour = parseInt(hourStr, 10);
  let period = "AM";

  if (hour >= 12) {
    period = "PM";
    if (hour > 12) hour -= 12;
  }
  if (hour === 0) hour = 12;

  // বাংলা সংখ্যায় রূপান্তর
  const bengaliDigits = (n) =>
    n.toString().replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[d]);
  const bengaliHour = bengaliDigits(hour);
  const bengaliMinute = bengaliDigits(minute);

  return `${bengaliHour}:${bengaliMinute} ${period === "AM" ? "AM" : "PM"}`;
}

// ----------------- Public: load posts -----------------
async function loadPosts() {
  const container = document.getElementById("postsContainer");
  const noPosts = document.getElementById("noPosts");

  try {
    const snapshot = await db
      .collection("posts")
      .orderBy("createdAt", "desc")
      .get();
    const posts = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    if (posts.length === 0) {
      container.innerHTML = "";
      noPosts.classList.remove("hidden");
      return;
    }

    noPosts.classList.add("hidden");

    container.innerHTML = posts
      .map(
        (post) => `
                    <article class="post-card bg-white rounded-xl shadow-md p-6 mb-6 fade-in">
                        <header class="mb-4">
                            <h2 class="text-2xl font-bold text-gray-900 mb-2">${escapeHtml(
                              post.title
                            )}</h2>
                            <div class="flex items-center text-sm text-gray-500">
                                <span class="mr-4">📅 ${escapeHtml(
                                  post.date || ""
                                )}</span>
                                <span>🕐 ${escapeHtml(post.time || "")}</span>
                            </div>
                        </header>
                        ${
                          post.imageUrl
                            ? `<img src="${post.imageUrl}" class="mb-4 max-h-80 w-full object-cover rounded-lg">`
                            : ""
                        }
                        <div class="prose prose-lg max-w-none">
                            <p style="white-space: pre-wrap;" class="text-gray-700 leading-relaxed">${escapeHtml(
                              post.content
                            )}</p>
                        </div>
                    </article>
                `
      )
      .join("");
  } catch (err) {
    console.error("loadPosts error", err);
    container.innerHTML =
      '<p class="text-red-500">পোস্ট লোড করতে সমস্যা হয়েছে। কনসোল চেক করুন।</p>';
  }
}

// ----------------- Admin: posts CRUD -----------------
async function publishPost() {
  const user = auth.currentUser;
  if (!user) {
    alert("প্রথমে লগইন করুন।");
    return;
  }

  const title = document.getElementById("postTitle").value.trim();
  const content = document.getElementById("postContent").value.trim();

  // guard for optional image input
  const imageElem = document.getElementById("postImage");
  const imageFile = imageElem ? imageElem.files[0] : null;

  if (!title || !content) {
    alert("শিরোনাম এবং কন্টেন্ট লিখুন!");
    return;
  }

  try {
    let imageUrl = "";
    if (imageFile) {
      const storageRef = storage
        .ref()
        .child("post_images/" + Date.now() + "_" + imageFile.name);
      const uploadTask = storageRef.put(imageFile);
      await uploadTask;
      imageUrl = await storageRef.getDownloadURL();
    }

    const now = new Date();
    const bengaliDate = now.toLocaleDateString("bn-BD");
    const bengaliTime = now.toLocaleTimeString("bn-BD", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    await db.collection("posts").add({
      title,
      content,
      imageUrl: imageUrl || null,
      date: bengaliDate,
      time: bengaliTime,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      author: user.email || null,
    });

    // clear form and reload admin posts
    document.getElementById("postTitle").value = "";
    document.getElementById("postContent").value = "";
    if (imageElem) imageElem.value = "";
    alert("পোস্ট সফলভাবে প্রকাশিত হয়েছে!");
    loadAdminPosts();
    loadPosts();
  } catch (err) {
    console.error("publishPost error", err);
    alert("পোস্ট প্রকাশ করতে সমস্যা হয়েছে। কনসোল চেক করুন।");
  }
}

async function saveDraft() {
  const user = auth.currentUser;
  if (!user) {
    alert("প্রথমে লগইন করুন।");
    return;
  }

  const title = document.getElementById("postTitle").value.trim();
  const content = document.getElementById("postContent").value.trim();

  if (!title && !content) {
    alert("অন্তত শিরোনাম বা কন্টেন্ট লিখুন!");
    return;
  }

  try {
    await db.collection("drafts").add({
      title: title || "শিরোনামহীন ড্রাফট",
      content: content,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      author: user.email || null,
    });

    document.getElementById("postTitle").value = "";
    document.getElementById("postContent").value = "";
    alert("ড্রাফট সেভ হয়েছে!");
    loadDrafts();
  } catch (err) {
    console.error("saveDraft error", err);
    alert("ড্রাফট সেভ করতে সমস্যা হয়েছে। কনসোল চেক করুন।");
  }
}

async function updatePostCount() {
  const snapshot = await db.collection("posts").get();
  document.getElementById("postCount").textContent = snapshot.size;
}

async function loadAdminPosts() {
  const container = document.getElementById("adminPostsList");
  const snapshot = await db
    .collection("posts")
    .orderBy("createdAt", "desc")
    .get();
  const posts = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  if (posts.length === 0) {
    container.innerHTML =
      '<p class="text-gray-500 text-center py-8">এখনো কোনো প্রকাশিত পোস্ট নেই</p>';
    updatePostCount();
    return;
  }

  container.innerHTML = posts
    .map(
      (post) => `
                <div class="bg-gray-50 rounded-lg p-4 mb-4 border">
                    <div class="flex justify-between items-start">
                        <div class="flex-1">
                            <h4 class="font-semibold text-gray-900 mb-2">${escapeHtml(
                              post.title
                            )}</h4>
                            <p class="text-gray-600 text-sm mb-2">${escapeHtml(
                              post.content
                                ? post.content.substring(0, 120) +
                                    (post.content.length > 120 ? "..." : "")
                                : ""
                            )}</p>
                            <div class="text-xs text-gray-500">📅 ${escapeHtml(
                              post.date || ""
                            )} • 🕐 ${escapeHtml(post.time || "")}</div>
                        </div>
                        <div class="flex gap-2 ml-4">
                            <button onclick="startEditPost('${
                              post.id
                            }', false)" class="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm transition-colors">✏️ এডিট</button>
                            <button onclick="deletePost('${
                              post.id
                            }')" class="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm transition-colors">🗑️ ডিলিট</button>
                        </div>
                    </div>
                </div>
            `
    )
    .join("");
  updatePostCount();
}

async function deletePost(docId) {
  if (!confirm("আপনি কি নিশ্চিত এই পোস্টটি ডিলিট করতে চান?")) return;
  await db.collection("posts").doc(docId).delete();
  alert("পোস্ট ডিলিট হয়েছে!");
  loadAdminPosts();
  loadPosts();
}

// ----------------- Drafts -----------------
async function loadDrafts() {
  const container = document.getElementById("draftsList");
  const snapshot = await db
    .collection("drafts")
    .orderBy("createdAt", "desc")
    .get();
  const drafts = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  document.getElementById("draftCount").textContent = drafts.length;

  if (drafts.length === 0) {
    container.innerHTML =
      '<p class="text-gray-500 text-center py-8">এখনো কোনো ড্রাফট নেই</p>';
    return;
  }

  container.innerHTML = drafts
    .map(
      (draft) => `
                <div class="bg-yellow-50 rounded-lg p-4 mb-4 border border-yellow-200">
                    <div class="flex justify-between items-start">
                        <div class="flex-1">
                            <h4 class="font-semibold text-gray-900 mb-2">${escapeHtml(
                              draft.title
                            )}</h4>
                            <p class="text-gray-600 text-sm mb-2">${escapeHtml(
                              draft.content
                                ? draft.content.substring(0, 120) +
                                    (draft.content.length > 120 ? "..." : "")
                                : "কোনো কন্টেন্ট নেই"
                            )}</p>
                            <div class="text-xs text-gray-500">📅 ${escapeHtml(
                              draft.createdAt
                                ? new Date(
                                    draft.createdAt.seconds * 1000
                                  ).toLocaleDateString("bn-BD")
                                : ""
                            )}</div>
                        </div>
                        <div class="flex gap-2 ml-4">
                            <button onclick="startEditPost('${
                              draft.id
                            }', true)" class="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm transition-colors">✏️ এডিট</button>
                            <button onclick="publishDraft('${
                              draft.id
                            }')" class="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm transition-colors">📝 পাবলিশ</button>
                            <button onclick="deleteDraft('${
                              draft.id
                            }')" class="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm transition-colors">🗑️ ডিলিট</button>
                        </div>
                    </div>
                </div>
            `
    )
    .join("");
}

async function deleteDraft(docId) {
  if (!confirm("আপনি কি নিশ্চিত এই ড্রাফটটি ডিলিট করতে চান?")) return;
  await db.collection("drafts").doc(docId).delete();
  alert("ড্রাফট ডিলিট হয়েছে!");
  loadDrafts();
}

async function publishDraft(docId) {
  const doc = await db.collection("drafts").doc(docId).get();
  if (!doc.exists) return alert("ড্রাফট পাওয়া যায়নি।");
  const data = doc.data();
  const now = new Date();
  const bengaliDate = now.toLocaleDateString("bn-BD");
  const bengaliTime = now.toLocaleTimeString("bn-BD", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  await db.collection("posts").add({
    title: data.title,
    content: data.content,
    imageUrl: null,
    date: bengaliDate,
    time: bengaliTime,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    author: data.author || null,
  });

  await db.collection("drafts").doc(docId).delete();
  alert("ড্রাফট প্রকাশ করা হয়েছে!");
  loadDrafts();
  loadAdminPosts();
  loadPosts();
}

// ----------------- Edit flow -----------------
async function startEditPost(docId, isDraft) {
  editingDocId = docId;
  editingIsDraft = isDraft;
  document.getElementById("editModal").classList.remove("hidden");

  const collection = isDraft ? "drafts" : "posts";
  const doc = await db.collection(collection).doc(docId).get();
  if (!doc.exists) return alert("ডকুমেন্ট পাওয়া যায়নি।");
  const data = doc.data();
  document.getElementById("editTitle").value = data.title || "";
  document.getElementById("editContent").value = data.content || "";
  document.getElementById("useCurrentDateTime").checked = true;
  document.getElementById("customDateTimeInputs").classList.add("hidden");

  // If user wants to edit with custom date/time, prefill the inputs with current values (if available)
  try {
    const cd = document.getElementById("customDate");
    const ct = document.getElementById("customTime");
    if (cd && data.date) {
      // Try to parse an ISO-ish date if stored; fallback leave empty
      // We won't force conversion; user can pick custom date manually.
    }
    if (ct && data.time) {
      // same: time is stored as string; user can switch to custom and edit
    }
  } catch (e) {
    // ignore
  }
}

async function saveEditedPost() {
  const title = document.getElementById("editTitle").value.trim();
  const content = document.getElementById("editContent").value.trim();
  if (!title || !content) {
    alert("শিরোনাম এবং কন্টেন্ট লিখুন!");
    return;
  }

  let finalDate, finalTime;
  if (document.getElementById("useCurrentDateTime").checked) {
    const now = new Date();
    finalDate = now.toLocaleDateString("bn-BD");
    finalTime = now.toLocaleTimeString("bn-BD", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } else {
    const customDate = document.getElementById("customDate").value;
    const customTime = document.getElementById("customTime").value;
    if (!customDate || !customTime) {
      alert("কাস্টম তারিখ ও সময় দিন!");
      return;
    }
    // যদি customBengaliDate ফিল্ডে কিছু লেখা থাকে তাহলে সেটা ব্যবহার করবো
    if (document.getElementById("customBengaliDate").value.trim()) {
      finalDate = document.getElementById("customBengaliDate").value.trim();
    } else {
      finalDate = new Date(customDate).toLocaleDateString("bn-BD");
    }

    // যদি customBengaliTime ফিল্ডে কিছু লেখা থাকে তাহলে সেটা ব্যবহার করবো
    if (document.getElementById("customBengaliTime").value.trim()) {
      finalTime = document.getElementById("customBengaliTime").value.trim();
    } else {
      finalTime = convertToBengaliTime(customTime);
    }
  }

  try {
    const collection = editingIsDraft ? "drafts" : "posts";
    const updates = { title, content, date: finalDate, time: finalTime };

    await db.collection(collection).doc(editingDocId).update(updates);
    alert("আপডেট করা হয়েছে!");
    closeEditModal();
    loadDrafts();
    loadAdminPosts();
    loadPosts();
  } catch (err) {
    console.error("saveEditedPost error", err);
    alert("আপডেট করতে সমস্যা হয়েছে। কনসোল চেক করুন।");
  }
}

// Tab navigation
function showTab(tabName) {
  document.getElementById("newPostContent").classList.add("hidden");
  document.getElementById("managePostsContent").classList.add("hidden");
  document.getElementById("draftsContent").classList.add("hidden");

  document.getElementById("newPostTab").className =
    "px-4 py-2 font-medium text-gray-500 hover:text-gray-700 whitespace-nowrap";
  document.getElementById("managePostsTab").className =
    "px-4 py-2 font-medium text-gray-500 hover:text-gray-700 ml-4 whitespace-nowrap";
  document.getElementById("draftsTab").className =
    "px-4 py-2 font-medium text-gray-500 hover:text-gray-700 ml-4 whitespace-nowrap";

  if (tabName === "newPost") {
    document.getElementById("newPostContent").classList.remove("hidden");
    document.getElementById("newPostTab").className =
      "px-4 py-2 font-medium text-blue-600 border-b-2 border-blue-600 whitespace-nowrap";
  } else if (tabName === "managePosts") {
    document.getElementById("managePostsContent").classList.remove("hidden");
    document.getElementById("managePostsTab").className =
      "px-4 py-2 font-medium text-blue-600 border-b-2 border-blue-600 ml-4 whitespace-nowrap";
    loadAdminPosts();
  } else if (tabName === "drafts") {
    document.getElementById("draftsContent").classList.remove("hidden");
    document.getElementById("draftsTab").className =
      "px-4 py-2 font-medium text-blue-600 border-b-2 border-blue-600 ml-4 whitespace-nowrap";
    loadDrafts();
  }
}

// Initial page load behavior
function checkUrlHash() {
  if (window.location.hash === "#admin") {
    showAdminLogin();
  } else {
    showPublicView();
  }
}

window.addEventListener("hashchange", checkUrlHash);
document.addEventListener("DOMContentLoaded", function () {
  checkUrlHash();

  // Attach save edited button safely after DOM loaded
  const saveBtn = document.getElementById("saveEditBtn");
  if (saveBtn) saveBtn.addEventListener("click", saveEditedPost);
});

// Helpful console notes
console.log(
  "READY: Open Firebase Console → Authentication → enable Email/Password → create user:",
  "muktadir1280@gmail.com"
);
console.log(
  "Firestore collections used: posts, drafts. Storage path: post_images/."
);
