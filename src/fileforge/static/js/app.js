/**
 * FileForge — Minimalist Mobile-First Engine
 */

document.addEventListener('DOMContentLoaded', () => {
  // Application State
  const state = {
    currentPath: '',
    showHidden: localStorage.getItem('ff_show_hidden') === 'true',
    viewMode: localStorage.getItem('ff_view_mode') || 'list',
    theme: localStorage.getItem('ff_theme') || 'system',
    sortBy: localStorage.getItem('ff_sort_by') || 'name',
    sortOrder: localStorage.getItem('ff_sort_order') || 'asc',
    confirmDelete: localStorage.getItem('ff_confirm_delete') !== 'false',
    items: [],
    selectedPaths: new Set(),
    activeContextItem: null,
    searchDebounceTimer: null,
    touchTimer: null
  };

  // Cache DOM Elements
  const el = {
    app: document.getElementById('app'),
    searchInput: document.getElementById('searchInput'),
    clearSearchBtn: document.getElementById('clearSearchBtn'),
    mobileSearchBtn: document.getElementById('mobileSearchBtn'),
    mobileSearchPanel: document.getElementById('mobileSearchPanel'),
    mobileSearchInput: document.getElementById('mobileSearchInput'),
    mobileClearSearchBtn: document.getElementById('mobileClearSearchBtn'),
    cancelMobileSearchBtn: document.getElementById('cancelMobileSearchBtn'),
    viewToggleBtn: document.getElementById('viewToggleBtn'),
    viewToggleIcon: document.getElementById('viewToggleIcon'),
    settingsBtn: document.getElementById('settingsBtn'),
    breadcrumbs: document.getElementById('breadcrumbs'),
    sortBtn: document.getElementById('sortBtn'),
    currentSortLabel: document.getElementById('currentSortLabel'),
    sortDropdown: document.getElementById('sortDropdown'),
    toggleSortOrderBtn: document.getElementById('toggleSortOrderBtn'),
    newFolderBtn: document.getElementById('newFolderBtn'),
    uploadBtn: document.getElementById('uploadBtn'),
    fileInput: document.getElementById('fileInput'),
    multiActionBar: document.getElementById('multiActionBar'),
    selectAllCheckbox: document.getElementById('selectAllCheckbox'),
    selectedCountText: document.getElementById('selectedCountText'),
    multiDownloadBtn: document.getElementById('multiDownloadBtn'),
    multiDeleteBtn: document.getElementById('multiDeleteBtn'),
    multiClearBtn: document.getElementById('multiClearBtn'),
    loadingState: document.getElementById('loadingState'),
    errorState: document.getElementById('errorState'),
    errorStateTitle: document.getElementById('errorStateTitle'),
    errorStateMessage: document.getElementById('errorStateMessage'),
    errorRetryBtn: document.getElementById('errorRetryBtn'),
    emptyState: document.getElementById('emptyState'),
    emptyStateTitle: document.getElementById('emptyStateTitle'),
    emptyStateMessage: document.getElementById('emptyStateMessage'),
    fileContainer: document.getElementById('fileContainer'),
    itemsWrapper: document.getElementById('itemsWrapper'),
    dropOverlay: document.getElementById('dropOverlay'),
    uploadProgressPanel: document.getElementById('uploadProgressPanel'),
    uploadPanelTitle: document.getElementById('uploadPanelTitle'),
    uploadProgressFill: document.getElementById('uploadProgressFill'),
    uploadList: document.getElementById('uploadList'),
    closeUploadPanelBtn: document.getElementById('closeUploadPanelBtn'),
    contextMenu: document.getElementById('contextMenu'),
    contextMenuTitle: document.getElementById('contextMenuTitle'),
    toastContainer: document.getElementById('toastContainer'),
    
    // Modals & Settings
    settingsModal: document.getElementById('settingsModal'),
    showHiddenToggle: document.getElementById('showHiddenToggle'),
    confirmDeleteToggle: document.getElementById('confirmDeleteToggle'),
    settingsStoragePercent: document.getElementById('settingsStoragePercent'),
    settingsStorageDetails: document.getElementById('settingsStorageDetails'),
    newFolderModal: document.getElementById('newFolderModal'),
    newFolderNameInput: document.getElementById('newFolderNameInput'),
    confirmNewFolderBtn: document.getElementById('confirmNewFolderBtn'),
    renameModal: document.getElementById('renameModal'),
    renameItemInput: document.getElementById('renameItemInput'),
    confirmRenameBtn: document.getElementById('confirmRenameBtn'),
    propertiesModal: document.getElementById('propertiesModal'),
    propName: document.getElementById('propName'),
    propType: document.getElementById('propType'),
    propSize: document.getElementById('propSize'),
    propPath: document.getElementById('propPath'),
    propMtime: document.getElementById('propMtime'),
    shareModal: document.getElementById('shareModal'),
    shareItemName: document.getElementById('shareItemName'),
    sharePasswordInput: document.getElementById('sharePasswordInput'),
    shareExpireSelect: document.getElementById('shareExpireSelect'),
    confirmShareBtn: document.getElementById('confirmShareBtn'),
    shareResultArea: document.getElementById('shareResultArea'),
    shareUrlOutput: document.getElementById('shareUrlOutput'),
    copyShareUrlBtn: document.getElementById('copyShareUrlBtn'),
    previewModal: document.getElementById('previewModal'),
    previewTitle: document.getElementById('previewTitle'),
    previewBody: document.getElementById('previewBody')
  };

  // --- Initial Setup ---
  initTheme(state.theme);
  setViewMode(state.viewMode);
  initSettingsUI();

  // Parse Initial Path from History / URL
  const initialPath = getPathFromUrl();
  history.replaceState({ path: initialPath }, '', getFolderUrl(initialPath));
  loadDirectory(initialPath, false);
  fetchStorageInfo();

  // --- Browser History (Popstate) Event Listener ---
  window.addEventListener('popstate', (e) => {
    closeAllModals();
    const targetPath = e.state ? (e.state.path ?? '') : getPathFromUrl();
    loadDirectory(targetPath, false);
  });

  // Global Keyboard Navigation
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAllModals();
      hideContextMenu();
    }
  });

  // --- Search Controls ---
  if (el.searchInput) el.searchInput.addEventListener('input', (e) => onSearchInput(e.target.value));
  if (el.clearSearchBtn) el.clearSearchBtn.addEventListener('click', clearSearch);
  if (el.mobileSearchBtn) {
    el.mobileSearchBtn.addEventListener('click', () => {
      el.mobileSearchPanel.classList.remove('hidden');
      el.mobileSearchInput.focus();
    });
  }
  if (el.cancelMobileSearchBtn) {
    el.cancelMobileSearchBtn.addEventListener('click', () => {
      el.mobileSearchPanel.classList.add('hidden');
      clearSearch();
    });
  }
  if (el.mobileSearchInput) el.mobileSearchInput.addEventListener('input', (e) => onSearchInput(e.target.value));
  if (el.mobileClearSearchBtn) el.mobileClearSearchBtn.addEventListener('click', clearSearch);

  // --- Header Actions ---
  if (el.viewToggleBtn) el.viewToggleBtn.addEventListener('click', toggleViewMode);
  if (el.settingsBtn) el.settingsBtn.addEventListener('click', () => openModal(el.settingsModal));

  // --- Sort & Toolbar ---
  if (el.sortBtn) {
    el.sortBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      el.sortDropdown.classList.toggle('hidden');
    });
  }
  document.addEventListener('click', () => {
    if (el.sortDropdown) el.sortDropdown.classList.add('hidden');
  });

  if (el.sortDropdown) {
    el.sortDropdown.querySelectorAll('.dropdown-item[data-sort]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.sortBy = btn.dataset.sort;
        localStorage.setItem('ff_sort_by', state.sortBy);
        updateSortUI();
        loadDirectory(state.currentPath, false);
      });
    });
  }

  if (el.toggleSortOrderBtn) {
    el.toggleSortOrderBtn.addEventListener('click', () => {
      state.sortOrder = state.sortOrder === 'asc' ? 'desc' : 'asc';
      localStorage.setItem('ff_sort_order', state.sortOrder);
      updateSortUI();
      loadDirectory(state.currentPath, false);
    });
  }

  if (el.newFolderBtn) el.newFolderBtn.addEventListener('click', promptNewFolder);
  if (el.uploadBtn) el.uploadBtn.addEventListener('click', () => el.fileInput.click());
  if (el.fileInput) el.fileInput.addEventListener('change', handleFileUpload);

  // --- Multi-select ---
  if (el.selectAllCheckbox) el.selectAllCheckbox.addEventListener('change', toggleSelectAll);
  if (el.multiDownloadBtn) el.multiDownloadBtn.addEventListener('click', handleMultiDownload);
  if (el.multiDeleteBtn) el.multiDeleteBtn.addEventListener('click', handleMultiDelete);
  if (el.multiClearBtn) el.multiClearBtn.addEventListener('click', clearSelection);

  // --- State Handlers ---
  if (el.errorRetryBtn) el.errorRetryBtn.addEventListener('click', () => loadDirectory(state.currentPath, false));
  if (el.closeUploadPanelBtn) el.closeUploadPanelBtn.addEventListener('click', () => el.uploadProgressPanel.classList.add('hidden'));

  // --- Modals Close Handlers ---
  document.querySelectorAll('.close-modal-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const modalId = btn.dataset.modal;
      if (modalId) closeModal(document.getElementById(modalId));
    });
  });

  // Backdrop click closes modals
  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeModal(backdrop);
    });
  });

  // --- Settings Listeners ---
  if (el.showHiddenToggle) {
    el.showHiddenToggle.addEventListener('change', (e) => {
      state.showHidden = e.target.checked;
      localStorage.setItem('ff_show_hidden', state.showHidden);
      loadDirectory(state.currentPath, false);
    });
  }

  if (el.confirmDeleteToggle) {
    el.confirmDeleteToggle.addEventListener('change', (e) => {
      state.confirmDelete = e.target.checked;
      localStorage.setItem('ff_confirm_delete', state.confirmDelete);
    });
  }

  document.querySelectorAll('.theme-option').forEach(btn => {
    btn.addEventListener('click', () => {
      setTheme(btn.dataset.themeVal);
    });
  });

  document.querySelectorAll('.segment-btn[data-view-val]').forEach(btn => {
    btn.addEventListener('click', () => {
      setViewMode(btn.dataset.viewVal);
    });
  });

  // --- Modal Form Actions ---
  if (el.confirmNewFolderBtn) el.confirmNewFolderBtn.addEventListener('click', submitNewFolder);
  if (el.confirmRenameBtn) el.confirmRenameBtn.addEventListener('click', submitRename);
  if (el.confirmShareBtn) el.confirmShareBtn.addEventListener('click', submitShare);
  if (el.copyShareUrlBtn) {
    el.copyShareUrlBtn.addEventListener('click', () => {
      el.shareUrlOutput.select();
      navigator.clipboard.writeText(el.shareUrlOutput.value);
      showToast('Copied to clipboard');
    });
  }

  // --- Context Menu Listeners ---
  document.addEventListener('click', hideContextMenu);
  if (el.contextMenu) {
    el.contextMenu.querySelectorAll('.menu-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        handleContextMenuAction(btn.dataset.action);
        hideContextMenu();
      });
    });
  }

  // Setup Drag & Drop Upload
  setupDragAndDrop();

  // ==========================================================================
  // Navigation & Directory Loading
  // ==========================================================================

  function getPathFromUrl() {
    const params = new URLSearchParams(window.location.search);
    if (params.has('path')) return params.get('path') || '';
    if (window.location.pathname.startsWith('/browse/')) {
      return decodeURIComponent(window.location.pathname.substring(8));
    }
    return '';
  }

  function getFolderUrl(path) {
    if (!path) return window.location.pathname.startsWith('/browse/') ? '/browse/' : '/';
    return `?path=${encodeURIComponent(path)}`;
  }

  function navigateToFolder(path) {
    if (path === state.currentPath) return;
    history.pushState({ path: path }, '', getFolderUrl(path));
    loadDirectory(path, false);
  }

  async function loadDirectory(path, pushHistory = true) {
    if (pushHistory) {
      history.pushState({ path: path }, '', getFolderUrl(path));
    }
    state.currentPath = path;
    clearSelection();

    showLoading(true);
    showError(false);
    showEmpty(false);
    el.itemsWrapper.innerHTML = '';

    try {
      const url = `/api/files/list?path=${encodeURIComponent(path)}&sort_by=${state.sortBy}&sort_order=${state.sortOrder}&show_hidden=${state.showHidden}`;
      const res = await fetch(url);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to load directory');
      }

      const data = await res.json();
      state.items = data.items || [];
      renderBreadcrumbs(data.breadcrumbs || []);

      if (state.items.length === 0) {
        showEmpty(true, 'Nothing here yet', 'Upload files or create a folder.');
      } else {
        renderItems(state.items);
      }
    } catch (err) {
      showError(true, "Couldn't open this folder", err.message || 'Folder inaccessible.');
    } finally {
      showLoading(false);
    }
  }

  // ==========================================================================
  // Search
  // ==========================================================================

  function onSearchInput(query) {
    const trimmed = query.trim();
    if (el.clearSearchBtn) el.clearSearchBtn.classList.toggle('hidden', !trimmed);
    if (el.mobileClearSearchBtn) el.mobileClearSearchBtn.classList.toggle('hidden', !trimmed);

    clearTimeout(state.searchDebounceTimer);
    state.searchDebounceTimer = setTimeout(() => {
      performSearch(trimmed);
    }, 220);
  }

  function clearSearch() {
    if (el.searchInput) el.searchInput.value = '';
    if (el.mobileSearchInput) el.mobileSearchInput.value = '';
    if (el.clearSearchBtn) el.clearSearchBtn.classList.add('hidden');
    if (el.mobileClearSearchBtn) el.mobileClearSearchBtn.classList.add('hidden');
    loadDirectory(state.currentPath, false);
  }

  async function performSearch(query) {
    if (!query) {
      loadDirectory(state.currentPath, false);
      return;
    }

    showLoading(true);
    showError(false);
    showEmpty(false);

    try {
      const url = `/api/files/list?path=${encodeURIComponent(state.currentPath)}&search=${encodeURIComponent(query)}&show_hidden=${state.showHidden}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Search failed');

      const data = await res.json();
      state.items = data.items || [];

      if (state.items.length === 0) {
        showEmpty(true, 'No files found', 'Try another search term.');
      } else {
        renderItems(state.items);
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  // ==========================================================================
  // Breadcrumbs & Item Rendering
  // ==========================================================================

  function renderBreadcrumbs(crumbs) {
    el.breadcrumbs.innerHTML = '';
    if (!crumbs || crumbs.length === 0) return;

    crumbs.forEach((crumb, idx) => {
      const li = document.createElement('li');
      const itemSpan = document.createElement('span');
      itemSpan.className = `breadcrumb-item ${idx === crumbs.length - 1 ? 'active' : ''}`;
      itemSpan.textContent = idx === 0 ? 'Files' : crumb.name;

      itemSpan.addEventListener('click', () => navigateToFolder(crumb.path));
      li.appendChild(itemSpan);

      if (idx < crumbs.length - 1) {
        const sep = document.createElement('span');
        sep.className = 'breadcrumb-sep';
        sep.textContent = '/';
        li.appendChild(sep);
      }

      el.breadcrumbs.appendChild(li);
    });
  }

  function renderItems(items) {
    el.itemsWrapper.innerHTML = '';

    items.forEach(item => {
      if (state.viewMode === 'grid') {
        renderGridCard(item);
      } else {
        renderListRow(item);
      }
    });
  }

  function renderListRow(item) {
    const row = document.createElement('div');
    row.className = `file-row ${state.selectedPaths.has(item.path) ? 'selected' : ''}`;
    row.dataset.path = item.path;

    const isSelected = state.selectedPaths.has(item.path);
    const sizeStr = item.is_dir ? '' : formatBytes(item.size);
    const dateStr = formatDate(item.mtime);
    const metaStr = [sizeStr, dateStr].filter(Boolean).join(' • ');
    const iconSvg = getItemIconSvg(item);

    row.innerHTML = `
      <label class="custom-checkbox-wrapper row-checkbox" onclick="event.stopPropagation()">
        <input type="checkbox" class="item-checkbox" ${isSelected ? 'checked' : ''}>
        <span class="checkbox-box"></span>
      </label>
      <div class="file-icon-box">
        ${getItemThumbnailOrIcon(item, iconSvg)}
      </div>
      <div class="file-info">
        <span class="file-title truncate">${escapeHtml(item.name)}</span>
        ${metaStr ? `<span class="file-meta">${metaStr}</span>` : ''}
      </div>
      <div class="row-actions" onclick="event.stopPropagation()">
        ${item.is_dir ? `
          <svg class="chevron-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
        ` : `
          <button class="icon-btn row-more-btn" title="More options">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>
          </button>
        `}
      </div>
    `;

    row.addEventListener('click', () => {
      if (item.is_dir) {
        navigateToFolder(item.path);
      } else {
        openPreview(item);
      }
    });

    const cb = row.querySelector('.item-checkbox');
    if (cb) {
      cb.addEventListener('change', (e) => {
        toggleItemSelection(item.path, e.target.checked, row);
      });
    }

    const moreBtn = row.querySelector('.row-more-btn');
    if (moreBtn) {
      moreBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showContextMenu(e.clientX, e.clientY, item);
      });
    }

    setupTouchAndContextMenu(row, item);
    el.itemsWrapper.appendChild(row);
  }

  function renderGridCard(item) {
    const card = document.createElement('div');
    card.className = `grid-card ${state.selectedPaths.has(item.path) ? 'selected' : ''}`;
    card.dataset.path = item.path;

    const isSelected = state.selectedPaths.has(item.path);
    const sizeStr = item.is_dir ? 'Folder' : formatBytes(item.size);
    const iconSvg = getItemIconSvg(item);

    card.innerHTML = `
      <label class="custom-checkbox-wrapper grid-checkbox" onclick="event.stopPropagation()">
        <input type="checkbox" class="item-checkbox" ${isSelected ? 'checked' : ''}>
        <span class="checkbox-box"></span>
      </label>
      <button class="icon-btn-sm grid-more-btn" title="More options" onclick="event.stopPropagation()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>
      </button>
      <div class="grid-thumb-box">
        ${getItemThumbnailOrIcon(item, iconSvg)}
      </div>
      <div class="grid-info">
        <span class="grid-title truncate">${escapeHtml(item.name)}</span>
        <span class="grid-meta">${sizeStr}</span>
      </div>
    `;

    card.addEventListener('click', () => {
      if (item.is_dir) {
        navigateToFolder(item.path);
      } else {
        openPreview(item);
      }
    });

    const cb = card.querySelector('.item-checkbox');
    if (cb) {
      cb.addEventListener('change', (e) => {
        toggleItemSelection(item.path, e.target.checked, card);
      });
    }

    const moreBtn = card.querySelector('.grid-more-btn');
    if (moreBtn) {
      moreBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showContextMenu(e.clientX, e.clientY, item);
      });
    }

    setupTouchAndContextMenu(card, item);
    el.itemsWrapper.appendChild(card);
  }

  function setupTouchAndContextMenu(element, item) {
    element.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showContextMenu(e.clientX, e.clientY, item);
    });

    element.addEventListener('touchstart', (e) => {
      state.touchTimer = setTimeout(() => {
        if (e.touches && e.touches[0]) {
          showContextMenu(e.touches[0].clientX, e.touches[0].clientY, item);
        }
      }, 450);
    }, { passive: true });

    element.addEventListener('touchend', () => clearTimeout(state.touchTimer));
    element.addEventListener('touchmove', () => clearTimeout(state.touchTimer));
  }

  function getItemThumbnailOrIcon(item, defaultSvg) {
    const ext = (item.extension || '').toLowerCase();
    const mime = item.mime_type || '';

    if (!item.is_dir && (mime.startsWith('image/') || ['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext))) {
      const src = `/api/files/download?path=${encodeURIComponent(item.path)}`;
      return `<img src="${src}" class="thumb-img" alt="${escapeHtml(item.name)}" loading="lazy" onerror="this.onerror=null; this.outerHTML='${escapeHtml(defaultSvg)}';">`;
    }
    return defaultSvg;
  }

  // ==========================================================================
  // Context Menu
  // ==========================================================================

  function showContextMenu(x, y, item) {
    state.activeContextItem = item;
    if (el.contextMenuTitle) el.contextMenuTitle.textContent = item.name;

    if (el.contextMenu) {
      el.contextMenu.classList.remove('hidden');
      const menuWidth = 180;
      const menuHeight = 220;
      const posX = Math.min(x, window.innerWidth - menuWidth - 10);
      const posY = Math.min(y, window.innerHeight - menuHeight - 10);

      el.contextMenu.style.left = `${Math.max(10, posX)}px`;
      el.contextMenu.style.top = `${Math.max(10, posY)}px`;
    }
  }

  function hideContextMenu() {
    if (el.contextMenu) el.contextMenu.classList.add('hidden');
  }

  function handleContextMenuAction(action) {
    const item = state.activeContextItem;
    if (!item) return;

    switch (action) {
      case 'open':
        if (item.is_dir) navigateToFolder(item.path);
        else openPreview(item);
        break;
      case 'download':
        window.location.href = `/api/files/download?path=${encodeURIComponent(item.path)}`;
        break;
      case 'rename':
        openRenameModal(item);
        break;
      case 'share':
        openShareModal(item);
        break;
      case 'properties':
        openPropertiesModal(item);
        break;
      case 'delete':
        confirmAndDeleteItems([item.path]);
        break;
    }
  }

  // ==========================================================================
  // Selection Logic
  // ==========================================================================

  function toggleItemSelection(path, isChecked, element) {
    if (isChecked) {
      state.selectedPaths.add(path);
      element.classList.add('selected');
    } else {
      state.selectedPaths.delete(path);
      element.classList.remove('selected');
    }
    updateMultiActionBar();
  }

  function toggleSelectAll(e) {
    const isChecked = e.target.checked;
    state.selectedPaths.clear();

    if (isChecked) {
      state.items.forEach(i => state.selectedPaths.add(i.path));
    }

    document.querySelectorAll('.file-row, .grid-card').forEach(card => {
      const cb = card.querySelector('.item-checkbox');
      if (cb) cb.checked = isChecked;
      card.classList.toggle('selected', isChecked);
    });

    updateMultiActionBar();
  }

  function clearSelection() {
    state.selectedPaths.clear();
    if (el.selectAllCheckbox) el.selectAllCheckbox.checked = false;
    document.querySelectorAll('.file-row, .grid-card').forEach(card => {
      card.classList.remove('selected');
      const cb = card.querySelector('.item-checkbox');
      if (cb) cb.checked = false;
    });
    updateMultiActionBar();
  }

  function updateMultiActionBar() {
    const count = state.selectedPaths.size;
    if (el.multiActionBar) el.multiActionBar.classList.toggle('hidden', count === 0);
    if (el.selectedCountText) el.selectedCountText.textContent = `${count} selected`;
    if (el.selectAllCheckbox) el.selectAllCheckbox.checked = count > 0 && count === state.items.length;
  }

  async function handleMultiDownload() {
    if (state.selectedPaths.size === 0) return;
    const paths = Array.from(state.selectedPaths);
    showToast('Creating ZIP...');
    try {
      const res = await fetch('/api/files/zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths })
      });
      if (!res.ok) throw new Error('Failed to create ZIP');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'archive.zip';
      a.click();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  function handleMultiDelete() {
    if (state.selectedPaths.size === 0) return;
    confirmAndDeleteItems(Array.from(state.selectedPaths));
  }

  async function confirmAndDeleteItems(paths) {
    if (paths.length === 0) return;
    if (state.confirmDelete) {
      const msg = paths.length === 1 ? `Delete '${paths[0].split('/').pop()}'?` : `Delete ${paths.length} items?`;
      if (!confirm(msg)) return;
    }

    try {
      const res = await fetch('/api/files/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths })
      });
      if (!res.ok) throw new Error('Failed to delete');
      showToast(`${paths.length} item(s) deleted`);
      fetchStorageInfo();
      loadDirectory(state.currentPath, false);
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // ==========================================================================
  // File Upload
  // ==========================================================================

  async function handleFileUpload(e) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (el.uploadProgressPanel) el.uploadProgressPanel.classList.remove('hidden');
    if (el.uploadPanelTitle) el.uploadPanelTitle.textContent = `Uploading ${files.length} file(s)...`;
    if (el.uploadProgressFill) el.uploadProgressFill.style.width = '10%';
    if (el.uploadList) el.uploadList.innerHTML = '';

    Array.from(files).forEach(f => {
      const row = document.createElement('div');
      row.className = 'upload-item-row';
      row.innerHTML = `
        <span class="truncate" style="max-width: 70%;">${escapeHtml(f.name)}</span>
        <span>${formatBytes(f.size)}</span>
      `;
      if (el.uploadList) el.uploadList.appendChild(row);
    });

    const formData = new FormData();
    formData.append('path', state.currentPath);
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }

    try {
      if (el.uploadProgressFill) el.uploadProgressFill.style.width = '60%';
      const res = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData
      });
      if (!res.ok) throw new Error('Upload failed');
      if (el.uploadProgressFill) el.uploadProgressFill.style.width = '100%';
      if (el.uploadPanelTitle) el.uploadPanelTitle.textContent = 'Upload complete';
      showToast(`Uploaded ${files.length} file(s)`);
      fetchStorageInfo();
      loadDirectory(state.currentPath, false);
      setTimeout(() => {
        if (el.uploadProgressPanel) el.uploadProgressPanel.classList.add('hidden');
      }, 3000);
    } catch (err) {
      if (el.uploadPanelTitle) el.uploadPanelTitle.textContent = 'Upload failed';
      showToast(err.message, 'error');
    } finally {
      if (el.fileInput) el.fileInput.value = '';
    }
  }

  function setupDragAndDrop() {
    let counter = 0;
    window.addEventListener('dragenter', (e) => {
      e.preventDefault();
      counter++;
      if (el.dropOverlay) el.dropOverlay.classList.remove('hidden');
    });

    window.addEventListener('dragleave', (e) => {
      e.preventDefault();
      counter--;
      if (counter === 0 && el.dropOverlay) el.dropOverlay.classList.add('hidden');
    });

    window.addEventListener('dragover', (e) => e.preventDefault());

    window.addEventListener('drop', (e) => {
      e.preventDefault();
      counter = 0;
      if (el.dropOverlay) el.dropOverlay.classList.add('hidden');
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFileUpload({ target: { files: e.dataTransfer.files } });
      }
    });
  }

  // ==========================================================================
  // Modals & Dialogs
  // ==========================================================================

  function promptNewFolder() {
    if (el.newFolderNameInput) el.newFolderNameInput.value = '';
    openModal(el.newFolderModal);
    setTimeout(() => {
      if (el.newFolderNameInput) el.newFolderNameInput.focus();
    }, 150);
  }

  async function submitNewFolder() {
    const name = el.newFolderNameInput ? el.newFolderNameInput.value.trim() : '';
    if (!name) return;
    try {
      const res = await fetch('/api/files/create-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: state.currentPath, name })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create folder');
      }
      closeModal(el.newFolderModal);
      showToast(`Folder '${name}' created`);
      loadDirectory(state.currentPath, false);
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  function openRenameModal(item) {
    state.activeContextItem = item;
    if (el.renameItemInput) el.renameItemInput.value = item.name;
    openModal(el.renameModal);
    setTimeout(() => {
      if (el.renameItemInput) el.renameItemInput.focus();
    }, 150);
  }

  async function submitRename() {
    const newName = el.renameItemInput ? el.renameItemInput.value.trim() : '';
    const item = state.activeContextItem;
    if (!newName || !item || newName === item.name) {
      closeModal(el.renameModal);
      return;
    }

    try {
      const res = await fetch('/api/files/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: item.path, new_name: newName })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to rename');
      }
      closeModal(el.renameModal);
      showToast(`Renamed to '${newName}'`);
      loadDirectory(state.currentPath, false);
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  function openPropertiesModal(item) {
    if (el.propName) el.propName.textContent = item.name;
    if (el.propType) el.propType.textContent = item.is_dir ? 'Directory' : item.mime_type || 'File';
    if (el.propSize) el.propSize.textContent = item.is_dir ? '--' : formatBytes(item.size);
    if (el.propPath) el.propPath.textContent = item.path || '/';
    if (el.propMtime) el.propMtime.textContent = formatDate(item.mtime);
    openModal(el.propertiesModal);
  }

  function openShareModal(item) {
    state.activeContextItem = item;
    if (el.shareItemName) el.shareItemName.textContent = `Sharing: ${item.name}`;
    if (el.sharePasswordInput) el.sharePasswordInput.value = '';
    if (el.shareResultArea) el.shareResultArea.classList.add('hidden');
    openModal(el.shareModal);
  }

  async function submitShare() {
    const item = state.activeContextItem;
    if (!item) return;

    try {
      const payload = {
        path: item.path,
        password: (el.sharePasswordInput && el.sharePasswordInput.value.trim()) || null,
        expires_in_seconds: (el.shareExpireSelect && el.shareExpireSelect.value) ? parseInt(el.shareExpireSelect.value) : null
      };

      const res = await fetch('/api/shares/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Failed to create share link');

      const data = await res.json();
      const shareUrl = `${window.location.origin}/api/shares/download/${data.id}`;
      if (el.shareUrlOutput) el.shareUrlOutput.value = shareUrl;
      if (el.shareResultArea) el.shareResultArea.classList.remove('hidden');
      showToast('Share link generated');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  function openPreview(item) {
    if (el.previewTitle) el.previewTitle.textContent = item.name;
    if (el.previewBody) el.previewBody.innerHTML = '<div class="liquid-spinner"></div>';
    openModal(el.previewModal);

    const downloadUrl = `/api/files/download?path=${encodeURIComponent(item.path)}`;
    const mime = item.mime_type || '';

    if (mime.startsWith('image/')) {
      if (el.previewBody) el.previewBody.innerHTML = `<img src="${downloadUrl}" alt="${escapeHtml(item.name)}">`;
    } else if (mime.startsWith('video/')) {
      if (el.previewBody) el.previewBody.innerHTML = `<video controls autoplay><source src="${downloadUrl}" type="${mime}">Video playback unsupported.</video>`;
    } else if (mime.startsWith('audio/')) {
      if (el.previewBody) el.previewBody.innerHTML = `<audio controls autoplay><source src="${downloadUrl}" type="${mime}">Audio playback unsupported.</audio>`;
    } else {
      fetch(`/api/files/preview?path=${encodeURIComponent(item.path)}`)
        .then(r => r.json())
        .then(data => {
          if (data.type === 'text' && el.previewBody) {
            el.previewBody.innerHTML = `<pre><code>${escapeHtml(data.content)}</code></pre>`;
          } else if (el.previewBody) {
            el.previewBody.innerHTML = `
              <div style="text-align:center; padding: 20px;">
                <p style="margin-bottom: 12px; color: var(--text-secondary);">Direct preview unavailable.</p>
                <a href="${downloadUrl}" class="action-btn-primary" style="display:inline-flex;">Download File</a>
              </div>`;
          }
        })
        .catch(() => {
          if (el.previewBody) {
            el.previewBody.innerHTML = `
              <div style="text-align:center; padding: 20px;">
                <a href="${downloadUrl}" class="action-btn-primary" style="display:inline-flex;">Download File</a>
              </div>`;
          }
        });
    }
  }

  // ==========================================================================
  // Storage Info & Settings Helpers
  // ==========================================================================

  async function fetchStorageInfo() {
    try {
      const res = await fetch('/api/storage/info');
      if (res.ok) {
        const data = await res.json();
        const percent = `${data.percent_used}%`;
        const usedGB = (data.used_bytes / (1024 ** 3)).toFixed(1);
        const totalGB = (data.total_bytes / (1024 ** 3)).toFixed(1);

        if (el.settingsStoragePercent) el.settingsStoragePercent.textContent = percent;
        if (el.settingsStorageDetails) el.settingsStorageDetails.textContent = `${usedGB} GB of ${totalGB} GB`;
      }
    } catch (e) {
      console.error(e);
    }
  }

  function initSettingsUI() {
    if (el.showHiddenToggle) el.showHiddenToggle.checked = state.showHidden;
    if (el.confirmDeleteToggle) el.confirmDeleteToggle.checked = state.confirmDelete;
    updateSortUI();
    updateThemeSelectorUI(state.theme);
    updateSegmentedControlUI(state.viewMode);
  }

  function updateSortUI() {
    const labelMap = { name: 'Name', mtime: 'Date', size: 'Size', type: 'Type' };
    if (el.currentSortLabel) el.currentSortLabel.textContent = labelMap[state.sortBy] || 'Sort';
    if (el.toggleSortOrderBtn) el.toggleSortOrderBtn.textContent = `Order: ${state.sortOrder === 'asc' ? 'Ascending' : 'Descending'}`;

    if (el.sortDropdown) {
      el.sortDropdown.querySelectorAll('.dropdown-item[data-sort]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.sort === state.sortBy);
      });
    }
  }

  function initTheme(theme) {
    state.theme = theme;
    localStorage.setItem('ff_theme', theme);
    const effectiveTheme = theme === 'system' 
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : theme;
    document.documentElement.setAttribute('data-theme', effectiveTheme);
    updateThemeSelectorUI(theme);
  }

  function setTheme(theme) {
    initTheme(theme);
  }

  function updateThemeSelectorUI(theme) {
    document.querySelectorAll('.theme-option').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.themeVal === theme);
    });
  }

  function setViewMode(mode) {
    state.viewMode = mode;
    localStorage.setItem('ff_view_mode', mode);
    if (el.fileContainer) el.fileContainer.className = `file-container ${mode}-view`;
    updateSegmentedControlUI(mode);

    if (el.viewToggleIcon) {
      if (mode === 'grid') {
        el.viewToggleIcon.innerHTML = `<line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line>`;
      } else {
        el.viewToggleIcon.innerHTML = `<rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect>`;
      }
    }

    if (state.items.length > 0) renderItems(state.items);
  }

  function toggleViewMode() {
    setViewMode(state.viewMode === 'grid' ? 'list' : 'grid');
  }

  function updateSegmentedControlUI(mode) {
    document.querySelectorAll('.segment-btn[data-view-val]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.viewVal === mode);
    });
  }

  function openModal(modalEl) {
    if (modalEl) modalEl.classList.remove('hidden');
  }

  function closeModal(modalEl) {
    if (modalEl) modalEl.classList.add('hidden');
  }

  function closeAllModals() {
    [el.settingsModal, el.newFolderModal, el.renameModal, el.propertiesModal, el.shareModal, el.previewModal].forEach(m => {
      if (m) closeModal(m);
    });
  }

  function showLoading(show) {
    if (el.loadingState) el.loadingState.classList.toggle('hidden', !show);
  }

  function showError(show, title = '', msg = '') {
    if (el.errorState) {
      el.errorState.classList.toggle('hidden', !show);
      if (show) {
        if (el.errorStateTitle) el.errorStateTitle.textContent = title;
        if (el.errorStateMessage) el.errorStateMessage.textContent = msg;
      }
    }
  }

  function showEmpty(show, title = '', msg = '') {
    if (el.emptyState) {
      el.emptyState.classList.toggle('hidden', !show);
      if (show) {
        if (el.emptyStateTitle) el.emptyStateTitle.textContent = title;
        if (el.emptyStateMessage) el.emptyStateMessage.textContent = msg;
      }
    }
  }

  function showToast(msg, type = 'info') {
    if (!el.toastContainer) return;
    const t = document.createElement('div');
    t.className = `toast-message ${type}`;
    t.textContent = msg;
    el.toastContainer.appendChild(t);
    setTimeout(() => {
      t.style.opacity = '0';
      t.style.transition = 'opacity 150ms ease';
      setTimeout(() => t.remove(), 150);
    }, 2500);
  }

  // ==========================================================================
  // Clean Line SVG Icons
  // ==========================================================================

  function getItemIconSvg(item) {
    if (item.is_dir) {
      return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`;
    }

    const ext = (item.extension || '').toLowerCase();
    const mime = item.mime_type || '';

    if (mime.startsWith('image/') || ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'].includes(ext)) {
      return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>`;
    }

    if (mime.startsWith('video/') || ['.mp4', '.mkv', '.webm', '.avi', '.mov'].includes(ext)) {
      return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect><line x1="7" y1="2" x2="7" y2="22"></line><line x1="17" y1="2" x2="17" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line></svg>`;
    }

    if (mime.startsWith('audio/') || ['.mp3', '.flac', '.wav', '.ogg', '.m4a'].includes(ext)) {
      return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>`;
    }

    if (['.py', '.js', '.ts', '.html', '.css', '.json', '.xml', '.c', '.cpp', '.h', '.sh'].includes(ext)) {
      return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>`;
    }

    if (['.zip', '.tar', '.gz', '.rar', '.7z', '.bz2'].includes(ext)) {
      return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"></polyline><rect x="1" y="3" width="22" height="5"></rect><line x1="10" y1="12" x2="14" y2="12"></line></svg>`;
    }

    if (ext === '.pdf') {
      return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>`;
    }

    return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>`;
  }

  // ==========================================================================
  // Formatting Utilities
  // ==========================================================================

  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function formatDate(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function escapeHtml(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
});
