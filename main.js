// ============================================
// FIREBASE CONFIGURATION
// ============================================
// IMPORTANT: Replace with your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyAnqlWmB3YL4lqoy_YeE4mD3ELk-5sUW8Q",
  authDomain: "muktadir-s-personal-blog.firebaseapp.com",
  projectId: "muktadir-s-personal-blog",
  storageBucket: "muktadir-s-personal-blog.firebasestorage.app",
  messagingSenderId: "868249534030",
  appId: "1:868249534030:web:4b790381ba8491fb998d1f",
  measurementId: "G-CY0GW8NP1K",
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// ============================================
// APPLICATION STATE
// ============================================
const app = {
  currentUser: null,
  posts: [],
  drafts: [],
  currentFilter: null,
  currentFilterType: null, // 'label' or 'archive'
  currentPost: null,

  // Pagination
  currentPage: 1,
  postsPerPage: 10,
  totalPages: 1,

  // ============================================
  // INITIALIZATION
  // ============================================
  init() {
    this.setupAuthListener();
    this.loadPosts();
    this.checkHashRoute();

    // Listen for hash changes
    window.addEventListener("hashchange", () => this.checkHashRoute());
  },

  checkHashRoute() {
    const hash = window.location.hash;
    if (hash === "#admin" && this.currentUser) {
      this.showAdminView();
    }
  },

  setupAuthListener() {
    auth.onAuthStateChanged((user) => {
      this.currentUser = user;
      this.updateAuthUI();

      if (user) {
        this.updateAdminStats();
      }
    });
  },

  updateAuthUI() {
    const authSection = document.getElementById("auth-section");
    const mobileAuthSection = document.getElementById("mobile-auth-section");

    if (this.currentUser) {
      const authButtons = `
        <div class="flex items-center gap-4">
          <button onclick="app.showAdminView()" 
            class="text-sm text-gray-600 hover:text-gray-900 font-semibold">
            Admin
          </button>
          <button onclick="app.logout()" 
            class="text-sm text-gray-600 hover:text-gray-900">
            Logout
          </button>
        </div>
      `;
      authSection.innerHTML = authButtons;

      // Mobile version
      mobileAuthSection.innerHTML = `
        <div class="space-y-3">
          <button onclick="app.showAdminView(); app.toggleMobileMenu();" 
            class="w-full text-left px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg font-semibold transition-colors">
            Admin Dashboard
          </button>
          <button onclick="app.logout(); app.toggleMobileMenu();" 
            class="w-full text-left px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
            Logout
          </button>
        </div>
      `;
    } else {
      authSection.innerHTML = `
        <button onclick="app.openLoginModal()" 
          class="text-sm text-gray-600 hover:text-gray-900">
          Admin Login
        </button>
      `;

      // Mobile version
      mobileAuthSection.innerHTML = `
        <button onclick="app.openLoginModal(); app.toggleMobileMenu();" 
          class="w-full text-left px-4 py-3 bg-gray-900 text-white hover:bg-gray-800 rounded-lg font-semibold transition-colors">
          Admin Login
        </button>
      `;
    }
  },

  // ============================================
  // AUTHENTICATION
  // ============================================
  openLoginModal() {
    document.getElementById("login-modal").classList.remove("hidden");
    document.getElementById("login-modal").classList.add("flex");
  },

  closeLoginModal() {
    document.getElementById("login-modal").classList.add("hidden");
    document.getElementById("login-modal").classList.remove("flex");
    document.getElementById("login-error").classList.add("hidden");
  },

  async login(event) {
    event.preventDefault();

    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;
    const errorDiv = document.getElementById("login-error");

    try {
      await auth.signInWithEmailAndPassword(email, password);
      this.closeLoginModal();
      this.showAdminView();
      window.location.hash = "admin";
    } catch (error) {
      errorDiv.textContent = error.message;
      errorDiv.classList.remove("hidden");
    }
  },

  async logout() {
    await auth.signOut();
    this.showHome();
    window.location.hash = "";
  },

  // ============================================
  // DATA LOADING
  // ============================================
  async loadPosts() {
    try {
      // Load ALL posts from Firebase (including old posts without isDraft field)
      const postsSnapshot = await db
        .collection("posts")
        .orderBy("createdAt", "desc")
        .get();

      // Filter published posts - treat posts without isDraft field as published
      this.posts = postsSnapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate(),
        }))
        .filter((post) => post.isDraft !== true); // Show posts that are NOT drafts (including old posts)

      console.log(
        `Loaded ${this.posts.length} published posts (including old posts)`,
      );

      // Load drafts if admin
      if (this.currentUser) {
        this.drafts = postsSnapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate(),
          }))
          .filter((post) => post.isDraft === true);

        console.log(`Loaded ${this.drafts.length} drafts`);
      }

      this.renderPosts();
      this.updateSidebar();
      this.updateAdminStats();
    } catch (error) {
      console.error("Error loading posts:", error);

      // Show user-friendly error message
      const feed = document.getElementById("posts-feed");
      if (error.code === "failed-precondition") {
        feed.innerHTML = `
          <div class="text-center py-12">
            <div class="text-red-600 font-semibold mb-2">⚠️ Database Index Required</div>
            <div class="text-gray-600 text-sm max-w-2xl mx-auto">
              <p class="mb-2">Firestore needs an index for this query.</p>
              <p class="mb-3">Click the link in the browser console to create it, then refresh the page.</p>
              <p class="text-xs text-gray-500">Or check the Firestore console → Indexes tab</p>
            </div>
          </div>
        `;
      } else if (error.code === "permission-denied") {
        feed.innerHTML = `
          <div class="text-center py-12">
            <div class="text-red-600 font-semibold mb-2">🔒 Permission Denied</div>
            <div class="text-gray-600 text-sm max-w-2xl mx-auto">
              <p class="mb-2">Check your Firestore security rules.</p>
              <p class="text-xs">Rules should allow public read access for the posts collection</p>
            </div>
          </div>
        `;
      } else {
        feed.innerHTML = `
          <div class="text-center py-12">
            <div class="text-red-600 font-semibold mb-2">Error Loading Posts</div>
            <div class="text-gray-600 text-sm">${error.message}</div>
            <div class="text-xs text-gray-500 mt-2">Check browser console for details</div>
          </div>
        `;
      }
    }
  },

  // ============================================
  // RENDERING
  // ============================================
  renderPosts() {
    const feed = document.getElementById("posts-feed");
    let postsToShow = this.posts;

    // Apply filters
    if (this.currentFilter) {
      if (this.currentFilterType === "label") {
        postsToShow = this.posts.filter(
          (post) => post.labels && post.labels.includes(this.currentFilter),
        );
      } else if (this.currentFilterType === "archive") {
        postsToShow = this.posts.filter((post) => {
          const date = new Date(post.createdAt);
          const monthYear = `${date.toLocaleString("default", { month: "long" })} ${date.getFullYear()}`;
          return monthYear === this.currentFilter;
        });
      }
    }

    // Calculate pagination
    this.totalPages = Math.ceil(postsToShow.length / this.postsPerPage);
    const startIndex = (this.currentPage - 1) * this.postsPerPage;
    const endIndex = startIndex + this.postsPerPage;
    const paginatedPosts = postsToShow.slice(startIndex, endIndex);

    if (postsToShow.length === 0) {
      // Different message if filtering vs no posts at all
      if (this.currentFilter) {
        feed.innerHTML = `
          <div class="text-center text-gray-400 py-12">
            <p>No posts found with this filter</p>
          </div>
        `;
      } else if (this.posts.length === 0) {
        // No posts exist at all - show welcome message
        feed.innerHTML = `
          <div class="text-center py-12 max-w-2xl mx-auto">
            <div class="text-6xl mb-4">📝</div>
            <h2 class="text-2xl playfair font-bold text-gray-900 mb-3">Welcome to Muktadir's Diary!</h2>
            <p class="text-gray-600 mb-6">Your blog is ready, but there are no posts yet.</p>
            ${
              this.currentUser
                ? `
              <p class="text-sm text-gray-500 mb-4">Click the "New Post" tab to create your first post!</p>
            `
                : `
              <p class="text-sm text-gray-500">The admin needs to create some posts first.</p>
            `
            }
          </div>
        `;
      } else {
        feed.innerHTML = `
          <div class="text-center text-gray-400 py-12">
            <p>No posts found</p>
          </div>
        `;
      }
      this.hidePagination();
      return;
    }

    feed.innerHTML = paginatedPosts
      .map((post) => {
        const contentLength = post.content.length;
        const showReadMore = contentLength > 500; // Show Read More if content > 500 characters
        const preview = showReadMore
          ? this.truncateText(post.content, 500)
          : post.content;

        // Format content properly
        const formattedPreview = this.formatContentForDisplay(preview);

        const date = new Date(post.createdAt).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });

        return `
                <article class="post-card bg-white rounded-xl shadow-md p-6 mb-6 fade-in hover-lift cursor-pointer" onclick="app.showPost('${post.id}')">
                    <h2 class="text-3xl playfair font-bold mb-3 hover:text-gray-700 transition-colors">
                        ${this.escapeHtml(post.title)}
                    </h2>
                    <div class="text-sm text-gray-500 mb-4">${date}</div>
                    <div class="text-gray-700 leading-relaxed mb-4">
                        ${formattedPreview}${showReadMore ? "..." : ""}
                    </div>
                    ${
                      post.labels && post.labels.length > 0
                        ? `
                        <div class="flex flex-wrap gap-2 mb-4">
                            ${post.labels
                              .map(
                                (label) => `
                                <span class="text-xs px-3 py-1 bg-gray-100 text-gray-700 rounded-full">
                                    ${this.escapeHtml(label)}
                                </span>
                            `,
                              )
                              .join("")}
                        </div>
                    `
                        : ""
                    }
                    ${
                      showReadMore
                        ? `
                        <button class="text-sm font-semibold text-gray-900 hover:underline inline-flex items-center gap-1">
                            Read More 
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                            </svg>
                        </button>
                    `
                        : ""
                    }
                </article>
            `;
      })
      .join("");

    // Update pagination controls
    this.updatePagination(postsToShow.length);
  },

  updatePagination(totalPosts) {
    const pagination = document.getElementById("pagination");
    const prevButton = document.getElementById("prev-page");
    const nextButton = document.getElementById("next-page");
    const pageInfo = document.getElementById("page-info");

    if (totalPosts <= this.postsPerPage) {
      // Don't show pagination if all posts fit on one page
      this.hidePagination();
      return;
    }

    pagination.classList.remove("hidden");

    // Show/hide Previous button (only show if not on first page)
    if (this.currentPage > 1) {
      prevButton.classList.remove("hidden");
    } else {
      prevButton.classList.add("hidden");
    }

    // Show/hide Next button
    if (this.currentPage >= this.totalPages) {
      nextButton.classList.add("hidden");
    } else {
      nextButton.classList.remove("hidden");
    }

    // Update page info
    pageInfo.textContent = `Page ${this.currentPage} of ${this.totalPages}`;
  },

  hidePagination() {
    document.getElementById("pagination").classList.add("hidden");
  },

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.renderPosts();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  },

  previousPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.renderPosts();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  },

  resetPagination() {
    this.currentPage = 1;
  },

  showPost(postId) {
    const post = this.posts.find((p) => p.id === postId);
    if (!post) return;

    this.currentPost = post;
    const date = new Date(post.createdAt).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    document.getElementById("posts-feed").classList.add("hidden");
    document.getElementById("filter-info").classList.add("hidden");
    document.getElementById("pagination").classList.add("hidden");
    const singlePost = document.getElementById("single-post");
    singlePost.classList.remove("hidden");

    document.getElementById("post-detail").innerHTML = `
            <article>
                <h1 class="text-4xl sm:text-5xl playfair font-bold mb-4">
                    ${this.escapeHtml(post.title)}
                </h1>
                <div class="text-sm text-gray-500 mb-8">${date}</div>
                ${
                  post.labels && post.labels.length > 0
                    ? `
                    <div class="flex flex-wrap gap-2 mb-8">
                        ${post.labels
                          .map(
                            (label) => `
                            <span class="text-xs px-3 py-1 bg-gray-100 text-gray-700 rounded-full">
                                ${this.escapeHtml(label)}
                            </span>
                        `,
                          )
                          .join("")}
                    </div>
                `
                    : ""
                }
                <div class="text-gray-800 leading-relaxed text-lg">
                    ${this.formatContentForDisplay(post.content)}
                </div>
            </article>
        `;

    window.scrollTo(0, 0);
  },

  showHome() {
    document.getElementById("public-view").classList.remove("hidden");
    document.getElementById("admin-view").classList.add("hidden");
    document.getElementById("posts-feed").classList.remove("hidden");
    document.getElementById("single-post").classList.add("hidden");

    if (this.currentFilter) {
      document.getElementById("filter-info").classList.remove("hidden");
    }

    // Re-render posts to show pagination buttons
    this.renderPosts();

    window.location.hash = "";
    this.currentPost = null;
  },

  updateSidebar() {
    this.renderLabels();
    this.renderArchive();

    // Also update mobile sidebar
    this.renderMobileLabels();
    this.renderMobileArchive();
  },

  toggleMobileMenu() {
    const mobileSidebar = document.getElementById("mobile-sidebar");
    mobileSidebar.classList.toggle("hidden");
  },

  renderLabels() {
    const labelsContainer = document.getElementById("labels-list");
    const allLabels = new Map();

    // Count posts per label
    this.posts.forEach((post) => {
      if (post.labels) {
        post.labels.forEach((label) => {
          allLabels.set(label, (allLabels.get(label) || 0) + 1);
        });
      }
    });

    if (allLabels.size === 0) {
      labelsContainer.innerHTML =
        '<span class="text-sm text-gray-400">No labels yet</span>';
      return;
    }

    labelsContainer.innerHTML = Array.from(allLabels.entries())
      .sort((a, b) => b[1] - a[1])
      .map(
        ([label, count]) => `
                <button onclick="app.filterByLabel('${this.escapeHtml(label)}')" 
                    class="label-tag text-xs px-3 py-1 bg-gray-100 text-gray-700 rounded-full ${this.currentFilter === label ? "active" : ""}">
                    ${this.escapeHtml(label)} (${count})
                </button>
            `,
      )
      .join("");
  },

  renderArchive() {
    const archiveContainer = document.getElementById("archive-list");
    const monthCounts = new Map();

    // Group posts by month/year
    this.posts.forEach((post) => {
      const date = new Date(post.createdAt);
      const monthYear = `${date.toLocaleString("default", { month: "long" })} ${date.getFullYear()}`;
      monthCounts.set(monthYear, (monthCounts.get(monthYear) || 0) + 1);
    });

    if (monthCounts.size === 0) {
      archiveContainer.innerHTML =
        '<div class="text-gray-400">No posts yet</div>';
      return;
    }

    archiveContainer.innerHTML = Array.from(monthCounts.entries())
      .map(
        ([monthYear, count]) => `
                <div onclick="app.filterByArchive('${monthYear}')" 
                    class="archive-item cursor-pointer py-1 text-gray-700 hover:text-gray-900 ${this.currentFilter === monthYear ? "active" : ""}">
                    ${monthYear} (${count})
                </div>
            `,
      )
      .join("");
  },

  renderMobileLabels() {
    const labelsContainer = document.getElementById("mobile-labels-list");
    const allLabels = new Map();

    // Count posts per label
    this.posts.forEach((post) => {
      if (post.labels) {
        post.labels.forEach((label) => {
          allLabels.set(label, (allLabels.get(label) || 0) + 1);
        });
      }
    });

    if (allLabels.size === 0) {
      labelsContainer.innerHTML =
        '<span class="text-sm text-gray-400">No labels yet</span>';
      return;
    }

    labelsContainer.innerHTML = Array.from(allLabels.entries())
      .sort((a, b) => b[1] - a[1])
      .map(
        ([label, count]) => `
            <button onclick="app.filterByLabel('${this.escapeHtml(label)}'); app.toggleMobileMenu();" 
                class="label-tag text-xs px-3 py-1 bg-gray-100 text-gray-700 rounded-full ${this.currentFilter === label ? "active" : ""}">
                ${this.escapeHtml(label)} (${count})
            </button>
        `,
      )
      .join("");
  },

  renderMobileArchive() {
    const archiveContainer = document.getElementById("mobile-archive-list");
    const monthCounts = new Map();

    // Group posts by month/year
    this.posts.forEach((post) => {
      const date = new Date(post.createdAt);
      const monthYear = `${date.toLocaleString("default", { month: "long" })} ${date.getFullYear()}`;
      monthCounts.set(monthYear, (monthCounts.get(monthYear) || 0) + 1);
    });

    if (monthCounts.size === 0) {
      archiveContainer.innerHTML =
        '<div class="text-gray-400">No posts yet</div>';
      return;
    }

    archiveContainer.innerHTML = Array.from(monthCounts.entries())
      .map(
        ([monthYear, count]) => `
                <div onclick="app.filterByArchive('${monthYear}'); app.toggleMobileMenu();" 
                    class="archive-item cursor-pointer py-1 text-gray-700 hover:text-gray-900 ${this.currentFilter === monthYear ? "active" : ""}">
                    ${monthYear} (${count})
                </div>
            `,
      )
      .join("");
  },

  // ============================================
  // FILTERING
  // ============================================
  filterByLabel(label) {
    this.resetPagination();
    this.currentFilter = label;
    this.currentFilterType = "label";
    document.getElementById("filter-text").textContent = `Label: ${label}`;
    document.getElementById("filter-info").classList.remove("hidden");
    document.getElementById("single-post").classList.add("hidden");
    document.getElementById("posts-feed").classList.remove("hidden");
    this.renderPosts();
    this.updateSidebar();
    window.scrollTo(0, 0);
  },

  filterByArchive(monthYear) {
    this.resetPagination();
    this.currentFilter = monthYear;
    this.currentFilterType = "archive";
    document.getElementById("filter-text").textContent =
      `Archive: ${monthYear}`;
    document.getElementById("filter-info").classList.remove("hidden");
    document.getElementById("single-post").classList.add("hidden");
    document.getElementById("posts-feed").classList.remove("hidden");
    this.renderPosts();
    this.updateSidebar();
    window.scrollTo(0, 0);
  },

  clearFilter() {
    this.resetPagination();
    this.currentFilter = null;
    this.currentFilterType = null;
    document.getElementById("filter-info").classList.add("hidden");
    this.renderPosts();
    this.updateSidebar();
  },

  // ============================================
  // ADMIN VIEW
  // ============================================
  showAdminView() {
    if (!this.currentUser) {
      this.openLoginModal();
      return;
    }

    document.getElementById("public-view").classList.add("hidden");
    document.getElementById("admin-view").classList.remove("hidden");
    this.switchAdminTab("new-post");
    this.loadManagePosts();
    this.loadDrafts();
    window.scrollTo(0, 0);
  },

  switchAdminTab(tabName) {
    // Update tab styles
    document.querySelectorAll(".admin-tab").forEach((tab) => {
      tab.classList.remove("active");
    });
    event.target.classList.add("active");

    // Show/hide content
    document.querySelectorAll(".admin-tab-content").forEach((content) => {
      content.classList.add("hidden");
    });
    document.getElementById(`tab-${tabName}`).classList.remove("hidden");

    // Load data if needed
    if (tabName === "manage-posts") {
      this.loadManagePosts();
    } else if (tabName === "drafts") {
      this.loadDrafts();
    }
  },

  async savePost(event, isDraft = false) {
    event.preventDefault();

    const title = document.getElementById("post-title").value.trim();
    const content = document.getElementById("post-content").value; // Don't trim - preserve exact formatting
    const labelsInput = document.getElementById("post-labels").value.trim();
    const labels = labelsInput
      ? labelsInput
          .split(",")
          .map((l) => l.trim())
          .filter((l) => l)
      : [];
    const editPostId = document.getElementById("edit-post-id").value;
    const customDateInput = document.getElementById("post-custom-date").value;

    const postData = {
      title,
      content,
      labels,
      isDraft,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };

    try {
      if (editPostId) {
        // Update existing post
        // Only update createdAt if custom date is provided
        if (customDateInput) {
          const customDate = new Date(customDateInput);
          postData.createdAt =
            firebase.firestore.Timestamp.fromDate(customDate);
        }
        await db.collection("posts").doc(editPostId).update(postData);
        alert(isDraft ? "Draft updated!" : "Post updated!");
      } else {
        // Create new post
        // Use custom date if provided, otherwise use server timestamp
        if (customDateInput) {
          const customDate = new Date(customDateInput);
          postData.createdAt =
            firebase.firestore.Timestamp.fromDate(customDate);
        } else {
          postData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        }
        await db.collection("posts").add(postData);
        alert(isDraft ? "Saved as draft!" : "Post published!");
      }

      this.resetForm();
      await this.loadPosts();

      if (!isDraft) {
        this.showHome();
      }
    } catch (error) {
      console.error("Error saving post:", error);
      alert("Error saving post: " + error.message);
    }
  },

  resetForm() {
    document.getElementById("post-form").reset();
    document.getElementById("edit-post-id").value = "";
    document.getElementById("post-custom-date").value = "";
  },

  async loadManagePosts() {
    const container = document.getElementById("manage-posts-list");

    if (this.posts.length === 0) {
      container.innerHTML =
        '<div class="text-center text-gray-400 py-12">No published posts</div>';
      return;
    }

    container.innerHTML = this.posts
      .map((post) => {
        const date = new Date(post.createdAt).toLocaleDateString();
        return `
                <div class="border border-gray-200 rounded-lg p-6 mb-4">
                    <h3 class="text-xl font-semibold mb-2">${this.escapeHtml(post.title)}</h3>
                    <div class="text-sm text-gray-500 mb-2">${date}</div>
                    ${
                      post.labels && post.labels.length > 0
                        ? `
                        <div class="flex flex-wrap gap-2 mb-4">
                            ${post.labels
                              .map(
                                (label) => `
                                <span class="text-xs px-2 py-1 bg-gray-100 rounded">
                                    ${this.escapeHtml(label)}
                                </span>
                            `,
                              )
                              .join("")}
                        </div>
                    `
                        : ""
                    }
                    <div class="flex gap-3 mt-4">
                        <button onclick="app.editPost('${post.id}')" 
                            class="text-sm text-blue-600 hover:underline">
                            Edit
                        </button>
                        <button onclick="app.deletePost('${post.id}')" 
                            class="text-sm text-red-600 hover:underline">
                            Delete
                        </button>
                    </div>
                </div>
            `;
      })
      .join("");
  },

  async loadDrafts() {
    const container = document.getElementById("drafts-list");

    if (this.drafts.length === 0) {
      container.innerHTML =
        '<div class="text-center text-gray-400 py-12">No drafts</div>';
      return;
    }

    container.innerHTML = this.drafts
      .map((draft) => {
        const date = new Date(draft.createdAt).toLocaleDateString();
        return `
                <div class="border border-gray-200 rounded-lg p-6 mb-4">
                    <h3 class="text-xl font-semibold mb-2">${this.escapeHtml(draft.title)}</h3>
                    <div class="text-sm text-gray-500 mb-2">${date}</div>
                    <div class="flex gap-3 mt-4">
                        <button onclick="app.editPost('${draft.id}', true)" 
                            class="text-sm text-blue-600 hover:underline">
                            Edit
                        </button>
                        <button onclick="app.publishDraft('${draft.id}')" 
                            class="text-sm text-green-600 hover:underline">
                            Publish
                        </button>
                        <button onclick="app.deletePost('${draft.id}', true)" 
                            class="text-sm text-red-600 hover:underline">
                            Delete
                        </button>
                    </div>
                </div>
            `;
      })
      .join("");
  },

  async editPost(postId, isDraft = false) {
    const post = isDraft
      ? this.drafts.find((p) => p.id === postId)
      : this.posts.find((p) => p.id === postId);

    if (!post) return;

    document.getElementById("edit-post-id").value = postId;
    document.getElementById("post-title").value = post.title;
    document.getElementById("post-content").value = post.content;
    document.getElementById("post-labels").value = post.labels
      ? post.labels.join(", ")
      : "";

    // Set custom date field with existing post date
    if (post.createdAt) {
      const date = new Date(post.createdAt);
      // Convert to local datetime string format (YYYY-MM-DDTHH:mm)
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      const dateTimeString = `${year}-${month}-${day}T${hours}:${minutes}`;
      document.getElementById("post-custom-date").value = dateTimeString;
    }

    this.switchAdminTab("new-post");
    document.querySelectorAll(".admin-tab")[0].classList.add("active");
    window.scrollTo(0, 0);
  },

  async deletePost(postId, isDraft = false) {
    if (!confirm("Are you sure you want to delete this post?")) return;

    try {
      await db.collection("posts").doc(postId).delete();
      await this.loadPosts();

      if (isDraft) {
        this.loadDrafts();
      } else {
        this.loadManagePosts();
      }
    } catch (error) {
      console.error("Error deleting post:", error);
      alert("Error deleting post: " + error.message);
    }
  },

  async publishDraft(draftId) {
    if (!confirm("Publish this draft?")) return;

    try {
      await db.collection("posts").doc(draftId).update({
        isDraft: false,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });

      await this.loadPosts();
      this.loadDrafts();
      alert("Draft published!");
    } catch (error) {
      console.error("Error publishing draft:", error);
      alert("Error publishing draft: " + error.message);
    }
  },

  async updateAdminStats() {
    if (!this.currentUser) return;

    const allLabels = new Set();
    this.posts.forEach((post) => {
      if (post.labels) {
        post.labels.forEach((label) => allLabels.add(label));
      }
    });

    document.getElementById("stat-posts").textContent = this.posts.length;
    document.getElementById("stat-labels").textContent = allLabels.size;
    document.getElementById("stat-drafts").textContent = this.drafts.length;
  },

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================
  truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substr(0, maxLength);
  },

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  },

  formatContentForDisplay(content) {
    // Split by lines, trim each line, remove empty leading/trailing lines
    const lines = content.split("\n");
    const trimmedLines = lines.map((line) => line.trim());

    // Remove leading empty lines
    while (trimmedLines.length > 0 && trimmedLines[0] === "") {
      trimmedLines.shift();
    }

    // Remove trailing empty lines
    while (
      trimmedLines.length > 0 &&
      trimmedLines[trimmedLines.length - 1] === ""
    ) {
      trimmedLines.pop();
    }

    // Join with <br> tags and escape HTML
    return trimmedLines.map((line) => this.escapeHtml(line)).join("<br>");
  },
};

// Initialize app when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  app.init();
});
