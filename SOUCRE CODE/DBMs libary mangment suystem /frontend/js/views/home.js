/**
 * Home View
 */
const HomeView = {
  async render(container) {
    container.innerHTML = `
      <section class="hero-search-section">
        <h1 class="hero-title">Track & Discover Books <span>Across Libraries</span></h1>
        <p class="hero-subtitle">
          Every physical copy uniquely tracked by barcode. Find the nearest available copy, 
          detect misplaced books, and borrow across the multi-library network.
        </p>

        <div class="search-box-wrapper">
          <form id="hero-search-form" class="search-bar-main" onsubmit="HomeView.handleSearch(event)">
            <i class="fa-solid fa-magnifying-glass" style="margin-right: 0.5rem; color: var(--text-muted); align-self: center;"></i>
            <input type="text" id="hero-search-input" class="search-input-field" placeholder="Search by title, author, ISBN, category, or keyword..." autocomplete="off">
            <button type="submit" class="btn btn-primary">Search</button>
          </form>

          <div class="search-filter-pills">
            <button class="filter-pill" onclick="HomeView.quickCategory('Machine Learning')">🤖 Machine Learning</button>
            <button class="filter-pill" onclick="HomeView.quickCategory('Artificial Intelligence')">🧠 Artificial Intelligence</button>
            <button class="filter-pill" onclick="HomeView.quickCategory('Software Engineering')">💻 Software Engineering</button>
            <button class="filter-pill" onclick="HomeView.quickCategory('Database Systems')">🗄️ Database Systems</button>
            <button class="filter-pill" onclick="HomeView.quickCategory('Self-Help')">⚡ Self-Help</button>
          </div>
        </div>
      </section>

      <!-- Key Capabilities Overview (Section 3.1) -->
      <section style="margin-bottom: 3rem;">
        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 1.5rem;">
          <div>
            <h2 style="font-size: 1.5rem; font-weight: 800;">Featured Catalog Titles</h2>
            <p style="color: var(--text-muted); font-size: 0.9rem;">Real-time inventory and availability across all branches</p>
          </div>
          <a href="#books" class="btn btn-secondary btn-sm">View All Catalog <i class="fa-solid fa-arrow-right"></i></a>
        </div>

        <div id="featured-books-grid" class="books-grid">
          <!-- Loading skeletons -->
          <div class="card skeleton" style="height: 220px;"></div>
          <div class="card skeleton" style="height: 220px;"></div>
          <div class="card skeleton" style="height: 220px;"></div>
        </div>
      </section>

      <!-- Network Libraries -->
      <section>
        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 1.5rem;">
          <div>
            <h2 style="font-size: 1.5rem; font-weight: 800;">Connected Library Branches</h2>
            <p style="color: var(--text-muted); font-size: 0.9rem;">Centralized network across Hyderabad with live shelf tracking</p>
          </div>
          <a href="#libraries" class="btn btn-secondary btn-sm">Branch Directory <i class="fa-solid fa-arrow-right"></i></a>
        </div>
        <div id="home-libraries-grid" class="stats-grid">
          <!-- Populated dynamically -->
        </div>
      </section>
    `;

    this.loadFeaturedBooks();
    this.loadLibraries();
  },

  handleSearch(e) {
    e.preventDefault();
    const query = document.getElementById('hero-search-input').value.trim();
    if (query) {
      window.location.hash = `#books?q=${encodeURIComponent(query)}`;
    } else {
      window.location.hash = '#books';
    }
  },

  quickCategory(cat) {
    window.location.hash = `#books?category=${encodeURIComponent(cat)}`;
  },

  async loadFeaturedBooks() {
    const grid = document.getElementById('featured-books-grid');
    if (!grid) return;

    try {
      const data = await API.get('/books');
      const books = (data.books || []).slice(0, 6);

      if (books.length === 0) {
        grid.innerHTML = '<p class="empty-state-text">No books found in catalog.</p>';
        return;
      }

      grid.innerHTML = books.map(b => {
        let stockBadge = '<span class="badge-stock no-stock">Out of Stock</span>';
        if (b.available_copies > 2) {
          stockBadge = `<span class="badge-stock available">● ${b.available_copies} Available</span>`;
        } else if (b.available_copies > 0) {
          stockBadge = `<span class="badge-stock low-stock">● ${b.available_copies} Low Stock</span>`;
        }

        return `
          <div class="book-card" onclick="window.location.hash='#book-details?id=${b.book_id}'">
            <div class="book-card-header">
              <div class="book-card-category">${b.category_name || 'General'}</div>
              <h3 class="book-card-title">${b.title}</h3>
              <div class="book-card-author">by ${b.author_name}</div>
            </div>
            <div class="book-card-body">
              <div class="book-card-meta">
                <span>ISBN: ${b.isbn || 'N/A'}</span>
                ${stockBadge}
              </div>
            </div>
          </div>
        `;
      }).join('');
    } catch (err) {
      grid.innerHTML = `<div class="empty-state-text" style="color:var(--rose-500)">Failed to load catalog. ${err.message}</div>`;
    }
  },

  async loadLibraries() {
    const grid = document.getElementById('home-libraries-grid');
    if (!grid) return;

    try {
      const data = await API.get('/libraries');
      const libs = data.libraries || [];

      grid.innerHTML = libs.map(l => `
        <div class="stat-card" style="cursor: pointer;" onclick="window.location.hash='#libraries'">
          <div class="stat-icon"><i class="fa-solid fa-building-columns"></i></div>
          <div class="stat-info">
            <div style="font-weight: 700; font-size: 1rem;">${l.library_name}</div>
            <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.35rem;">${l.address.split(',')[0]}</div>
            <div>
              <span class="badge-stock available" style="font-size: 0.7rem;">${l.available_copies} Available</span>
              <span style="font-size: 0.75rem; color: var(--text-muted);">/ ${l.total_copies} Copies</span>
            </div>
          </div>
        </div>
      `).join('');
    } catch (_) {}
  }
};

window.HomeView = HomeView;
