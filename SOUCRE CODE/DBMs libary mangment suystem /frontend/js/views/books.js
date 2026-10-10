/**
 * Catalog Search & Discovery View (Section 8.1, 9.3)
 */
const BooksView = {
  currentFilters: {
    q: '',
    category: '',
    author: '',
    year: ''
  },

  async render(container, queryParams = {}) {
    this.currentFilters.q = queryParams.q || '';
    this.currentFilters.category = queryParams.category || '';
    this.currentFilters.author = queryParams.author || '';
    this.currentFilters.year = queryParams.year || '';

    container.innerHTML = `
      <div style="margin-bottom: 2rem;">
        <h1 style="font-size: 2rem; font-weight: 800; margin-bottom: 0.5rem;">Library Catalog Discovery</h1>
        <p style="color: var(--text-muted); font-size: 0.95rem;">
          Cross-branch search across 25+ titles and 65+ tracked physical copies.
        </p>
      </div>

      <!-- Search Filters Card -->
      <div class="card" style="margin-bottom: 2rem;">
        <form id="catalog-filter-form" onsubmit="BooksView.applyFilters(event)" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)) 100px; gap: 1rem; align-items: flex-end;">
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">Search Query</label>
            <input type="text" id="filter-q" class="form-input" placeholder="Title, author, ISBN..." value="${this.currentFilters.q}">
          </div>

          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">Category</label>
            <select id="filter-category" class="form-select">
              <option value="">All Categories</option>
              <option value="Machine Learning" ${this.currentFilters.category === 'Machine Learning' ? 'selected' : ''}>Machine Learning</option>
              <option value="Artificial Intelligence" ${this.currentFilters.category === 'Artificial Intelligence' ? 'selected' : ''}>Artificial Intelligence</option>
              <option value="Software Engineering" ${this.currentFilters.category === 'Software Engineering' ? 'selected' : ''}>Software Engineering</option>
              <option value="Computer Science" ${this.currentFilters.category === 'Computer Science' ? 'selected' : ''}>Computer Science</option>
              <option value="Database Systems" ${this.currentFilters.category === 'Database Systems' ? 'selected' : ''}>Database Systems</option>
              <option value="Self-Help" ${this.currentFilters.category === 'Self-Help' ? 'selected' : ''}>Self-Help</option>
            </select>
          </div>

          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">Author Name</label>
            <input type="text" id="filter-author" class="form-input" placeholder="e.g. Andrew Ng" value="${this.currentFilters.author}">
          </div>

          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">Year</label>
            <input type="number" id="filter-year" class="form-input" placeholder="e.g. 2020" value="${this.currentFilters.year}">
          </div>

          <button type="submit" class="btn btn-primary" style="height: 44px;">
            Filter
          </button>
        </form>
      </div>

      <!-- Results Stats & Grid -->
      <div id="results-count" style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 1rem;">Loading catalog titles...</div>
      <div id="catalog-books-grid" class="books-grid">
        <div class="card skeleton" style="height: 220px;"></div>
        <div class="card skeleton" style="height: 220px;"></div>
        <div class="card skeleton" style="height: 220px;"></div>
      </div>
    `;

    this.fetchAndRenderBooks();
  },

  applyFilters(e) {
    e.preventDefault();
    this.currentFilters.q = document.getElementById('filter-q').value.trim();
    this.currentFilters.category = document.getElementById('filter-category').value.trim();
    this.currentFilters.author = document.getElementById('filter-author').value.trim();
    this.currentFilters.year = document.getElementById('filter-year').value.trim();

    const params = new URLSearchParams();
    if (this.currentFilters.q) params.set('q', this.currentFilters.q);
    if (this.currentFilters.category) params.set('category', this.currentFilters.category);
    if (this.currentFilters.author) params.set('author', this.currentFilters.author);
    if (this.currentFilters.year) params.set('year', this.currentFilters.year);

    window.location.hash = `#books?${params.toString()}`;
  },

  async fetchAndRenderBooks() {
    const grid = document.getElementById('catalog-books-grid');
    const countEl = document.getElementById('results-count');
    if (!grid) return;

    try {
      const params = new URLSearchParams();
      if (this.currentFilters.q) params.set('q', this.currentFilters.q);
      if (this.currentFilters.category) params.set('category', this.currentFilters.category);
      if (this.currentFilters.author) params.set('author', this.currentFilters.author);
      if (this.currentFilters.year) params.set('year', this.currentFilters.year);

      const data = await API.get(`/books?${params.toString()}`);
      const books = data.books || [];

      countEl.textContent = `Found ${books.length} matching titles across the library network`;

      if (books.length === 0) {
        grid.innerHTML = `
          <div class="card empty-state" style="grid-column: 1 / -1;">
            <div class="empty-state-icon">🔍</div>
            <div class="empty-state-title">No books match your criteria</div>
            <p class="empty-state-text">Try loosening your search query or selecting a different subject category.</p>
            <button class="btn btn-secondary btn-sm" onclick="BooksView.clearFilters()">Clear All Filters</button>
          </div>
        `;
        return;
      }

      grid.innerHTML = books.map(b => {
        let stockBadge = '<span class="badge-stock no-stock">No stock</span>';
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
              <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.25rem;">
                Publisher: ${b.publisher_name || 'N/A'} (${b.publication_year || 'N/A'})
              </div>
              <div class="book-card-meta">
                <span style="font-family: var(--font-mono); font-size: 0.75rem;">${b.isbn || 'No ISBN'}</span>
                ${stockBadge}
              </div>
            </div>
          </div>
        `;
      }).join('');
    } catch (err) {
      grid.innerHTML = `<div class="empty-state-text" style="color:var(--rose-500)">Failed to search catalog: ${err.message}</div>`;
    }
  },

  clearFilters() {
    window.location.hash = '#books';
  }
};

window.BooksView = BooksView;
