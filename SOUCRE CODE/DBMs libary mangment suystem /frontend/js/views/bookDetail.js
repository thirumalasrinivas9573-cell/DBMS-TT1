/**
 * Book Details View with Multi-Library Availability and Geolocation (Section 8.1, 9.3, 11.3)
 */
const BookDetailView = {
  currentBookId: null,
  userLat: 17.385044, // Default to Hyderabad Center
  userLng: 78.486671,

  async render(container, queryParams = {}) {
    const bookId = parseInt(queryParams.id, 10);
    if (!bookId) {
      container.innerHTML = '<div class="empty-state-title">Invalid Book ID</div>';
      return;
    }
    this.currentBookId = bookId;

    container.innerHTML = `
      <div style="margin-bottom: 1.5rem;">
        <a href="#books" class="btn btn-secondary btn-sm"><i class="fa-solid fa-arrow-left"></i> Back to Catalog</a>
      </div>

      <div id="book-header-card" class="card" style="margin-bottom: 2rem;">
        <div class="skeleton" style="height: 120px;"></div>
      </div>

      <!-- Geolocation Discovery Bar -->
      <div class="card" style="margin-bottom: 2rem; background: linear-gradient(135deg, var(--bg-surface), var(--bg-secondary)); border: 1px solid var(--border-medium);">
        <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 1rem;">
          <div>
            <div style="font-weight: 700; font-size: 1.1rem; display: flex; align-items: center; gap: 0.5rem;">
              <span style="color: var(--amber-500);"><i class="fa-solid fa-location-crosshairs"></i></span>
              Cross-Library Availability & Distance
            </div>
            <div id="location-status-text" style="font-size: 0.85rem; color: var(--text-muted);">
              Calculated using straight-line Haversine spherical formula from Hyderabad center.
            </div>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="BookDetailView.detectLocation()">
            <i class="fa-solid fa-location-arrow"></i> Use My GPS Location
          </button>
        </div>
      </div>

      <!-- Availability Table (Section 9.3) -->
      <div class="card" style="margin-bottom: 2rem;">
        <h3 style="font-size: 1.2rem; font-weight: 700; margin-bottom: 1rem;">Branches Holding Copies</h3>
        <div id="availability-table-wrapper" class="table-container">
          <div style="padding: 2rem; text-align: center; color: var(--text-muted);">Calculating branch availability...</div>
        </div>
      </div>

      <!-- Physical Copies Inventory -->
      <div class="card">
        <h3 style="font-size: 1.2rem; font-weight: 700; margin-bottom: 1rem;">Tracked Physical Copies (Barcodes)</h3>
        <div id="physical-copies-wrapper" class="table-container">
          <div style="padding: 2rem; text-align: center; color: var(--text-muted);">Loading copy details...</div>
        </div>
      </div>
    `;

    this.loadBookMetadata();
    this.loadAvailability();
  },

  async loadBookMetadata() {
    const card = document.getElementById('book-header-card');
    if (!card) return;

    try {
      const data = await API.get(`/books/${this.currentBookId}`);
      const b = data.book;
      const copies = data.copies || [];

      card.innerHTML = `
        <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-start; gap: 1.5rem;">
          <div style="flex: 1; min-width: 280px;">
            <div class="book-card-category" style="font-size: 0.85rem;">${b.category_name || 'General Catalog'}</div>
            <h1 style="font-size: 1.85rem; font-weight: 800; margin-bottom: 0.4rem; line-height: 1.25;">${b.title}</h1>
            <div style="font-size: 1.1rem; color: var(--text-secondary); margin-bottom: 1rem;">
              By <strong>${b.author_name}</strong>
            </div>
            
            <div style="display: flex; flex-wrap: wrap; gap: 1.5rem; font-size: 0.85rem; color: var(--text-muted);">
              <div><strong style="color:var(--text-primary)">ISBN:</strong> ${b.isbn || 'N/A'}</div>
              <div><strong style="color:var(--text-primary)">Publisher:</strong> ${b.publisher_name || 'N/A'}</div>
              <div><strong style="color:var(--text-primary)">Year:</strong> ${b.publication_year || 'N/A'}</div>
            </div>
          </div>

          <div style="background-color: var(--bg-secondary); padding: 1.25rem; border-radius: var(--radius-md); text-align: center; min-width: 180px;">
            <div style="font-size: 2rem; font-weight: 800; color: var(--amber-600); line-height: 1;">
              ${data.available_copies}
            </div>
            <div style="font-size: 0.8rem; font-weight: 600; text-transform: uppercase; margin-top: 0.25rem;">
              Available Copies
            </div>
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.35rem;">
              out of ${data.total_copies} network total
            </div>
          </div>
        </div>
      `;

      // Render physical copies table
      const copyWrapper = document.getElementById('physical-copies-wrapper');
      if (copyWrapper) {
        if (copies.length === 0) {
          copyWrapper.innerHTML = '<div style="padding:1.5rem; text-align:center;">No physical copies found for this title.</div>';
          return;
        }

        copyWrapper.innerHTML = `
          <table class="table">
            <thead>
              <tr>
                <th>Barcode</th>
                <th>Holding Library</th>
                <th>Home Rack</th>
                <th>Status</th>
                <th>Current Location</th>
              </tr>
            </thead>
            <tbody>
              ${copies.map(c => `
                <tr>
                  <td><code style="font-family: var(--font-mono); font-weight: 700; color: var(--amber-600);">${c.barcode}</code></td>
                  <td>${c.library_name}</td>
                  <td>${c.home_rack_number ? 'Rack ' + c.home_rack_number : 'Unassigned'}</td>
                  <td><span class="badge-stock ${c.status === 'AVAILABLE' ? 'available' : 'no-stock'}">${c.status}</span></td>
                  <td>${c.current_location_type}: ${c.current_location_id || 'With Reader'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
      }

    } catch (err) {
      card.innerHTML = `<div style="color:var(--rose-500)">Error loading book: ${err.message}</div>`;
    }
  },

  async loadAvailability() {
    const wrapper = document.getElementById('availability-table-wrapper');
    if (!wrapper) return;

    try {
      const data = await API.get(`/books/${this.currentBookId}/availability?lat=${this.userLat}&lng=${this.userLng}`);
      const libs = data.libraries || [];
      const best = data.best_match;

      if (libs.length === 0) {
        wrapper.innerHTML = '<div style="padding:1.5rem;">No library holding data available.</div>';
        return;
      }

      wrapper.innerHTML = `
        <table class="table">
          <thead>
            <tr>
              <th>Library Branch</th>
              <th>Available Copies</th>
              <th>Distance</th>
              <th>Shelf Rack</th>
              <th>Availability Status</th>
            </tr>
          </thead>
          <tbody>
            ${libs.map(l => {
              const isBest = best && best.library_id === l.library_id;
              let statusLabel = '';
              if (l.available_copies > 2) {
                statusLabel = '<span class="badge-stock available">● Available Now</span>';
              } else if (l.available_copies > 0) {
                statusLabel = '<span class="badge-stock low-stock">● Low Stock</span>';
              } else {
                statusLabel = '<span class="badge-stock no-stock">● Out of Stock</span>';
              }

              return `
                <tr class="${isBest ? 'tr-best-match' : ''}">
                  <td>
                    <div style="font-weight: 700;">${l.library_name}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">${l.address.split(',')[0]}</div>
                  </td>
                  <td>
                    <strong style="font-size: 1.05rem;">${l.available_copies}</strong>
                    <span style="font-size: 0.8rem; color: var(--text-muted);">/ ${l.total_copies}</span>
                  </td>
                  <td>
                    <strong>${l.distance_km} km</strong>
                    ${isBest ? '<span class="badge-stock available" style="margin-left: 0.4rem; font-size: 0.7rem;">🌟 Best match</span>' : ''}
                  </td>
                  <td>
                    ${l.available_racks.length > 0 ? l.available_racks.map(r => `<span class="badge-stock low-stock" style="font-size:0.75rem">Rack ${r}</span>`).join(' ') : '<span style="color:var(--text-muted)">—</span>'}
                  </td>
                  <td>${statusLabel}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `;
    } catch (err) {
      wrapper.innerHTML = `<div style="padding:1.5rem; color:var(--rose-500)">Failed to load branch availability: ${err.message}</div>`;
    }
  },

  detectLocation() {
    const statusText = document.getElementById('location-status-text');
    if (!navigator.geolocation) {
      Toast.error('Geolocation is not supported by your browser.');
      return;
    }

    if (statusText) statusText.textContent = 'Acquiring GPS coordinates from device...';

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.userLat = pos.coords.latitude;
        this.userLng = pos.coords.longitude;
        if (statusText) {
          statusText.textContent = `Live GPS detected (${this.userLat.toFixed(4)}, ${this.userLng.toFixed(4)}). Distance recalculating...`;
        }
        Toast.success('Location updated successfully!');
        this.loadAvailability();
      },
      (err) => {
        Toast.warning('Could not acquire GPS position. Using default Hyderabad center coordinates.');
        if (statusText) {
          statusText.textContent = 'Using default Hyderabad center coordinates.';
        }
      }
    );
  }
};

window.BookDetailView = BookDetailView;
