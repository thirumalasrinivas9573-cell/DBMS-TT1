/**
 * Libraries Directory View (Section 8.1, 12)
 */
const LibrariesView = {
  async render(container) {
    container.innerHTML = `
      <div style="margin-bottom: 2rem;">
        <h1 style="font-size: 2rem; font-weight: 800; margin-bottom: 0.5rem;">Connected Library Branches</h1>
        <p style="color: var(--text-muted); font-size: 0.95rem;">
          Hyderabad multi-library physical branches with live stock and internal layout tracking.
        </p>
      </div>

      <div id="libraries-list-grid" class="books-grid" style="grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));">
        <div class="card skeleton" style="height: 240px;"></div>
        <div class="card skeleton" style="height: 240px;"></div>
        <div class="card skeleton" style="height: 240px;"></div>
      </div>

      <!-- Branch Layout Modal -->
      <div id="branch-modal" class="modal-backdrop">
        <div class="modal-content">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
            <h2 id="modal-branch-name" style="font-size: 1.4rem; font-weight: 800;">Branch Details</h2>
            <button class="btn btn-secondary btn-sm" onclick="LibrariesView.closeModal()">✕</button>
          </div>
          <div id="modal-branch-body">Loading branch layout...</div>
        </div>
      </div>
    `;

    this.loadLibraries();
  },

  async loadLibraries() {
    const grid = document.getElementById('libraries-list-grid');
    if (!grid) return;

    try {
      const data = await API.get('/libraries');
      const libs = data.libraries || [];

      grid.innerHTML = libs.map(l => `
        <div class="card card-elevated" style="display: flex; flex-direction: column;">
          <div style="display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 1rem;">
            <div class="logo-badge" style="font-size: 1.25rem; width: 44px; height: 44px;">
              <i class="fa-solid fa-landmark"></i>
            </div>
            <span class="badge-stock available">● ${l.available_copies} Available</span>
          </div>

          <h3 style="font-size: 1.3rem; font-weight: 800; margin-bottom: 0.5rem;">${l.library_name}</h3>
          <p style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 1rem; flex: 1;">
            <i class="fa-solid fa-location-dot" style="color: var(--amber-500); margin-right: 0.4rem;"></i>
            ${l.address}
          </p>

          <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1.25rem;">
            <div><i class="fa-solid fa-phone" style="width: 18px;"></i> ${l.phone || 'N/A'}</div>
            <div><i class="fa-solid fa-envelope" style="width: 18px;"></i> ${l.email || 'N/A'}</div>
            <div><i class="fa-solid fa-compass" style="width: 18px;"></i> ${l.latitude.toFixed(6)}, ${l.longitude.toFixed(6)}</div>
          </div>

          <div style="display: flex; gap: 0.5rem; border-top: 1px solid var(--border-light); padding-top: 1rem;">
            <button class="btn btn-secondary btn-sm" style="flex: 1;" onclick="LibrariesView.openModal(${l.library_id})">
              <i class="fa-solid fa-table-cells"></i> View Layout
            </button>
            <a href="https://www.google.com/maps/search/?api=1&query=${l.latitude},${l.longitude}" target="_blank" class="btn btn-primary btn-sm" style="flex: 1;">
              <i class="fa-solid fa-map-location-dot"></i> View on Map
            </a>
          </div>
        </div>
      `).join('');
    } catch (err) {
      grid.innerHTML = `<div style="color:var(--rose-500)">Failed to load libraries: ${err.message}</div>`;
    }
  },

  async openModal(libId) {
    const modal = document.getElementById('branch-modal');
    const nameEl = document.getElementById('modal-branch-name');
    const bodyEl = document.getElementById('modal-branch-body');
    if (!modal) return;

    modal.classList.add('open');
    bodyEl.innerHTML = '<div style="text-align:center; padding: 2rem;">Loading branch layout details...</div>';

    try {
      const data = await API.get(`/libraries/${libId}`);
      const lib = data.library;
      nameEl.textContent = lib.library_name;

      bodyEl.innerHTML = `
        <div style="margin-bottom: 1.5rem;">
          <h4 style="font-size: 1rem; font-weight: 700; margin-bottom: 0.5rem; color: var(--amber-600);">
            <i class="fa-solid fa-shelves"></i> Racks (${lib.racks.length})
          </h4>
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 0.5rem;">
            ${lib.racks.map(r => `
              <div style="background-color: var(--bg-secondary); padding: 0.6rem; border-radius: var(--radius-sm); border: 1px solid var(--border-light);">
                <div style="font-weight: 700;">Rack ${r.rack_number}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">${r.category || 'General'}</div>
              </div>
            `).join('')}
          </div>
        </div>

        <div>
          <h4 style="font-size: 1rem; font-weight: 700; margin-bottom: 0.5rem; color: #3B82F6;">
            <i class="fa-solid fa-chair"></i> Reading Tables (${lib.reading_tables.length})
          </h4>
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 0.5rem;">
            ${lib.reading_tables.map(t => `
              <div style="background-color: var(--bg-secondary); padding: 0.6rem; border-radius: var(--radius-sm); border: 1px solid var(--border-light);">
                <div style="font-weight: 700;">Table ${t.table_number}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">${t.area_name || 'Study Area'}</div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    } catch (err) {
      bodyEl.innerHTML = `<div style="color:var(--rose-500)">Failed to load branch details: ${err.message}</div>`;
    }
  },

  closeModal() {
    const modal = document.getElementById('branch-modal');
    if (modal) modal.classList.remove('open');
  }
};

window.LibrariesView = LibrariesView;
