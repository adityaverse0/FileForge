/**
 * FileForge — Minimalist Mobile-First Engine with Watch Media Mode
 */

document.addEventListener('DOMContentLoaded', () => {
  // Application State
  const state = {
    currentTab: 'files',
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
    touchTimer: null,

    // Watch Media State
    watch: {
      videos: [],
      folders: [],
      activeFolder: '',
      search: '',
      sort: 'name:asc',
      viewMode: 'grid',
      activeVideoPath: null,
      activeMetadata: null,
      progressInterval: null
    }
  };

  // Cache DOM Elements
  const el = {
    app: document.getElementById('app'),
    navFilesBtn: document.getElementById('navFilesBtn'),
    navWatchBtn: document.getElementById('navWatchBtn'),
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
    filesNavBar: document.getElementById('filesNavBar'),
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
    fileBrowserSection: document.getElementById('fileBrowserSection'),
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

    // Watch Mode Elements
    watchSection: document.getElementById('watchSection'),
    continueWatchingShelf: document.getElementById('continueWatchingShelf'),
    continueWatchingGrid: document.getElementById('continueWatchingGrid'),
    watchFolderPills: document.getElementById('watchFolderPills'),
    watchSearchInput: document.getElementById('watchSearchInput'),
    watchSortSelect: document.getElementById('watchSortSelect'),
    watchViewToggleBtn: document.getElementById('watchViewToggleBtn'),
    watchViewIcon: document.getElementById('watchViewIcon'),
    watchVideoGrid: document.getElementById('watchVideoGrid'),
    watchEmptyState: document.getElementById('watchEmptyState'),

    // Watch Player Modal Elements
    watchPlayerModal: document.getElementById('watchPlayerModal'),
    closeWatchPlayerBtn: document.getElementById('closeWatchPlayerBtn'),
    watchPlayerTitle: document.getElementById('watchPlayerTitle'),
    watchPlayerSub: document.getElementById('watchPlayerSub'),
    watchPlayerFavBtn: document.getElementById('watchPlayerFavBtn'),
    watchPlayerFavIcon: document.getElementById('watchPlayerFavIcon'),
    watchVideoElement: document.getElementById('watchVideoElement'),
    watchNoticeToast: document.getElementById('watchNoticeToast'),
    watchSpeedSelect: document.getElementById('watchSpeedSelect'),
    watchSubSelect: document.getElementById('watchSubSelect'),
    watchPipBtn: document.getElementById('watchPipBtn'),

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

  // Check URL path for watch mode vs file browser
  const pathname = window.location.pathname;
  if (pathname.startsWith('/watch')) {
    switchTab('watch', false);
  } else {
    const initialPath = getPathFromUrl();
    history.replaceState({ path: initialPath, tab: 'files' }, '', getFolderUrl(initialPath));
    loadDirectory(initialPath, false);
  }

  fetchStorageInfo();

  // --- Navigation Tabs Switcher (Files / Watch) ---
  if (el.navFilesBtn) el.navFilesBtn.addEventListener('click', () => switchTab('files'));
  if (el.navWatchBtn) el.navWatchBtn.addEventListener('click', () => switchTab('watch'));

  function switchTab(tabName, pushState = true) {
    state.currentTab = tabName;

    if (el.navFilesBtn) el.navFilesBtn.classList.toggle('active', tabName === 'files');
    if (el.navWatchBtn) el.navWatchBtn.classList.toggle('active', tabName === 'watch');

    if (tabName === 'files') {
      if (el.filesNavBar) el.filesNavBar.classList.remove('hidden');
      if (el.fileBrowserSection) el.fileBrowserSection.classList.remove('hidden');
      if (el.watchSection) el.watchSection.classList.add('hidden');
      if (pushState) history.pushState({ path: state.currentPath, tab: 'files' }, '', getFolderUrl(state.currentPath));
      loadDirectory(state.currentPath, false);
    } else {
      if (el.filesNavBar) el.filesNavBar.classList.add('hidden');
      if (el.fileBrowserSection) el.fileBrowserSection.classList.add('hidden');
      if (el.multiActionBar) el.multiActionBar.classList.add('hidden');
      if (el.watchSection) el.watchSection.classList.remove('hidden');
      if (pushState) history.pushState({ tab: 'watch' }, '', '/watch');
      loadWatchData();
    }
  }

  // --- Browser History (Popstate) Event Listener ---
  window.addEventListener('popstate', (e) => {
    closeAllModals();
    if (e.state && e.state.tab === 'watch') {
      switchTab('watch', false);
    } else {
      const targetPath = e.state ? (e.state.path ?? '') : getPathFromUrl();
      switchTab('files', false);
      loadDirectory(targetPath, false);
    }
  });

  // Global Keyboard Navigation
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!el.watchPlayerModal.classList.contains('hidden')) {
        closeWatchPlayer();
      } else {
        closeAllModals();
        hideContextMenu();
      }
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

  // ==========================================================================
  // File Server Engine Functions
  // ==========================================================================

  async function loadDirectory(subPath, pushHistory = true) {
    state.currentPath = subPath;
    clearSelection();
    showLoading(true);
    showError(false);
    showEmpty(false);

    if (pushHistory) {
      history.pushState({ path: subPath, tab: 'files' }, '', getFolderUrl(subPath));
    }

    renderBreadcrumbs(subPath);

    const queryParams = new URLSearchParams({
      path: subPath,
      show_hidden: state.showHidden ? 'true' : 'false',
      sort_by: state.sortBy,
      sort_order: state.sortOrder
    });

    try {
      const resp = await fetch(`/api/files/list?${queryParams.toString()}`);
      if (!resp.ok) {
        throw new Error(`HTTP error! status: ${resp.status}`);
      }
      const data = await resp.json();
      state.items = data.items || [];

      showLoading(false);

      if (state.items.length === 0) {
        showEmpty(true, 'Nothing here yet', 'Upload files or create a folder to get started.');
        el.itemsWrapper.innerHTML = '';
      } else {
        renderItems(state.items);
      }
    } catch (err) {
      showLoading(false);
      showError(true, "Couldn't open this folder", err.message || 'Check connection or permissions.');
    }
  }

  function getFolderUrl(path) {
    return path ? `/browse/${path}` : '/';
  }

  function getPathFromUrl() {
    const pathname = window.location.pathname;
    if (pathname.startsWith('/browse/')) {
      return decodeURIComponent(pathname.substring(8));
    }
    return '';
  }

  function renderBreadcrumbs(path) {
    if (!el.breadcrumbs) return;
    el.breadcrumbs.innerHTML = '';

    const rootLi = document.createElement('li');
    rootLi.className = 'breadcrumb-item';
    const rootBtn = document.createElement('button');
    rootBtn.textContent = 'Storage';
    rootBtn.addEventListener('click', () => loadDirectory(''));
    rootLi.appendChild(rootBtn);
    el.breadcrumbs.appendChild(rootLi);

    if (!path) return;

    const parts = path.split('/').filter(Boolean);
    let accum = '';

    parts.forEach((part, index) => {
      accum += (accum ? '/' : '') + part;
      const currentAccum = accum;

      const li = document.createElement('li');
      li.className = 'breadcrumb-item';

      if (index === parts.length - 1) {
        const span = document.createElement('span');
        span.textContent = part;
        li.appendChild(span);
      } else {
        const btn = document.createElement('button');
        btn.textContent = part;
        btn.addEventListener('click', () => loadDirectory(currentAccum));
        li.appendChild(btn);
      }

      el.breadcrumbs.appendChild(li);
    });
  }

  function renderItems(items) {
    if (!el.itemsWrapper) return;
    el.itemsWrapper.innerHTML = '';

    items.forEach(item => {
      const card = document.createElement('div');
      card.className = `file-card ${state.viewMode === 'grid' ? 'grid-card' : 'list-card'}`;
      card.dataset.path = item.path;

      const iconSvg = getItemIconSvg(item);
      const formattedSize = item.is_dir ? '' : formatBytes(item.size);
      const formattedDate = formatDate(item.mtime);

      if (state.viewMode === 'grid') {
        card.innerHTML = `
          <div class="grid-thumb">
            ${iconSvg}
          </div>
          <div class="grid-info">
            <span class="grid-title truncate">${escapeHtml(item.name)}</span>
            <span class="grid-meta">${item.is_dir ? 'Folder' : formattedSize}</span>
          </div>
        `;
      } else {
        card.innerHTML = `
          <label class="custom-checkbox-wrapper select-checkbox" onclick="event.stopPropagation()">
            <input type="checkbox" class="item-checkbox" data-path="${escapeHtml(item.path)}">
            <span class="checkbox-box"></span>
          </label>
          <div class="item-icon-wrapper">${iconSvg}</div>
          <div class="item-details">
            <span class="item-name truncate">${escapeHtml(item.name)}</span>
            <span class="item-meta">${item.is_dir ? 'Folder' : formattedSize} · ${formattedDate}</span>
          </div>
          <button class="more-btn icon-btn-sm" title="More options" aria-label="More options">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="1"></circle>
              <circle cx="12" cy="5" r="1"></circle>
              <circle cx="12" cy="19" r="1"></circle>
            </svg>
          </button>
        `;
      }

      // Checkbox event
      const cb = card.querySelector('.item-checkbox');
      if (cb) {
        cb.checked = state.selectedPaths.has(item.path);
        cb.addEventListener('change', (e) => {
          e.stopPropagation();
          if (cb.checked) state.selectedPaths.add(item.path);
          else state.selectedPaths.delete(item.path);
          updateMultiSelectUI();
        });
      }

      // Card click -> Navigate or Open
      card.addEventListener('click', (e) => {
        if (e.target.closest('.custom-checkbox-wrapper') || e.target.closest('.more-btn')) return;
        if (item.is_dir) {
          loadDirectory(item.path);
        } else {
          openFilePreview(item);
        }
      });

      // Context menu
      card.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showContextMenu(e.clientX, e.clientY, item);
      });

      const moreBtn = card.querySelector('.more-btn');
      if (moreBtn) {
        moreBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const rect = moreBtn.getBoundingClientRect();
          showContextMenu(rect.left, rect.bottom + 4, item);
        });
      }

      el.itemsWrapper.appendChild(card);
    });
  }

  // ==========================================================================
  // Watch Media Mode Logic
  // ==========================================================================

  if (el.watchSearchInput) {
    el.watchSearchInput.addEventListener('input', (e) => {
      state.watch.search = e.target.value;
      loadWatchVideos();
    });
  }

  if (el.watchSortSelect) {
    el.watchSortSelect.addEventListener('change', (e) => {
      state.watch.sort = e.target.value;
      loadWatchVideos();
    });
  }

  if (el.watchViewToggleBtn) {
    el.watchViewToggleBtn.addEventListener('click', () => {
      state.watch.viewMode = state.watch.viewMode === 'grid' ? 'list' : 'grid';
      el.watchVideoGrid.classList.toggle('list-view', state.watch.viewMode === 'list');
    });
  }

  if (el.closeWatchPlayerBtn) {
    el.closeWatchPlayerBtn.addEventListener('click', closeWatchPlayer);
  }

  async function loadWatchData() {
    await loadContinueWatching();
    await loadWatchVideos();
  }

  async function loadContinueWatching() {
    try {
      const resp = await fetch('/api/watch/progress');
      if (!resp.ok) return;
      const data = await resp.json();
      const progressList = data.progress || [];

      if (!el.continueWatchingShelf || !el.continueWatchingGrid) return;

      if (progressList.length === 0) {
        el.continueWatchingShelf.classList.add('hidden');
        el.continueWatchingGrid.innerHTML = '';
      } else {
        el.continueWatchingShelf.classList.remove('hidden');
        el.continueWatchingGrid.innerHTML = '';

        progressList.forEach(item => {
          const card = document.createElement('div');
          card.className = 'watch-card continue-card';
          const thumbUrl = `/api/watch/thumbnail?path=${encodeURIComponent(item.path)}`;
          const percent = item.percent || 0;

          card.innerHTML = `
            <div class="thumb-container">
              <img class="thumb-img" src="${thumbUrl}" alt="" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">
              <div class="thumb-placeholder" style="display:none">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
              </div>
              <span class="duration-badge">${percent}%</span>
              <div class="progress-bar-bottom">
                <div class="progress-bar-fill" style="width: ${percent}%"></div>
              </div>
            </div>
            <div class="card-info">
              <span class="card-title">${escapeHtml(item.title || item.name)}</span>
            </div>
          `;

          card.addEventListener('click', () => openWatchPlayer(item.path));
          el.continueWatchingGrid.appendChild(card);
        });
      }
    } catch (e) {
      console.warn("Couldn't load continue watching:", e);
    }
  }

  async function loadWatchVideos() {
    showLoading(true);
    if (el.watchEmptyState) el.watchEmptyState.classList.add('hidden');

    const [sortBy, sortOrder] = state.watch.sort.split(':');
    const isFavOnly = state.watch.activeFolder === 'favorites';
    const folderFilter = (isFavOnly || !state.watch.activeFolder) ? '' : state.watch.activeFolder;

    const params = new URLSearchParams({
      sort_by: sortBy,
      sort_order: sortOrder
    });

    if (state.watch.search) params.append('search', state.watch.search);
    if (folderFilter) params.append('folder', folderFilter);
    if (isFavOnly) params.append('favorite_only', 'true');

    try {
      const resp = await fetch(`/api/watch/videos?${params.toString()}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();

      state.watch.videos = data.videos || [];
      state.watch.folders = data.folders || [];

      renderFolderPills(state.watch.folders);
      renderWatchGrid(state.watch.videos);
      showLoading(false);
    } catch (err) {
      showLoading(false);
      showToast("Error loading Watch videos: " + err.message, "error");
    }
  }

  function renderFolderPills(folders) {
    if (!el.watchFolderPills) return;
    el.watchFolderPills.innerHTML = '';

    const allPill = document.createElement('button');
    allPill.className = `folder-pill ${state.watch.activeFolder === '' ? 'active' : ''}`;
    allPill.textContent = 'All';
    allPill.addEventListener('click', () => {
      state.watch.activeFolder = '';
      loadWatchVideos();
    });
    el.watchFolderPills.appendChild(allPill);

    const favPill = document.createElement('button');
    favPill.className = `folder-pill ${state.watch.activeFolder === 'favorites' ? 'active' : ''}`;
    favPill.textContent = 'Favorites';
    favPill.addEventListener('click', () => {
      state.watch.activeFolder = 'favorites';
      loadWatchVideos();
    });
    el.watchFolderPills.appendChild(favPill);

    folders.forEach(f => {
      const pill = document.createElement('button');
      pill.className = `folder-pill ${state.watch.activeFolder === f ? 'active' : ''}`;
      pill.textContent = f;
      pill.addEventListener('click', () => {
        state.watch.activeFolder = f;
        loadWatchVideos();
      });
      el.watchFolderPills.appendChild(pill);
    });
  }

  function renderWatchGrid(videos) {
    if (!el.watchVideoGrid) return;
    el.watchVideoGrid.innerHTML = '';

    if (videos.length === 0) {
      if (el.watchEmptyState) el.watchEmptyState.classList.remove('hidden');
      return;
    }

    videos.forEach(v => {
      const card = document.createElement('div');
      card.className = 'watch-card';
      const thumbUrl = `/api/watch/thumbnail?path=${encodeURIComponent(v.path)}`;
      const formattedSize = formatBytes(v.size);
      const progressPercent = v.progress ? (v.progress.percent || 0) : 0;
      const isFav = v.is_favorite || false;

      card.innerHTML = `
        <div class="thumb-container">
          <img class="thumb-img" src="${thumbUrl}" alt="" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">
          <div class="thumb-placeholder" style="display:none">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect><line x1="7" y1="2" x2="7" y2="22"></line><line x1="17" y1="2" x2="17" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line></svg>
          </div>
          <button class="card-fav-btn ${isFav ? 'active' : ''}" title="Favorite" aria-label="Favorite">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
          </button>
          ${progressPercent > 0 ? `
            <div class="progress-bar-bottom">
              <div class="progress-bar-fill" style="width: ${progressPercent}%"></div>
            </div>
          ` : ''}
        </div>
        <div class="card-info">
          <span class="card-title">${escapeHtml(v.title || v.name)}</span>
          <div class="card-meta">
            <span>${v.folder || 'Root'}</span>
            <span class="meta-dot">·</span>
            <span>${formattedSize}</span>
          </div>
        </div>
      `;

      // Favorite toggle
      const favBtn = card.querySelector('.card-fav-btn');
      favBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleWatchFavorite(v.path, !isFav);
      });

      card.addEventListener('click', () => openWatchPlayer(v.path));
      el.watchVideoGrid.appendChild(card);
    });
  }

  async function toggleWatchFavorite(path, setFavorite) {
    try {
      const method = setFavorite ? 'POST' : 'DELETE';
      const resp = await fetch('/api/watch/favorites', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path })
      });
      if (resp.ok) {
        showToast(setFavorite ? "Added to Favorites" : "Removed from Favorites");
        loadWatchVideos();
      }
    } catch (e) {
      showToast("Error updating favorite", "error");
    }
  }

  // --- Watch Video Player ---
  async function openWatchPlayer(videoPath) {
    state.watch.activeVideoPath = videoPath;

    // Reset player elements
    el.watchVideoElement.pause();
    el.watchVideoElement.removeAttribute('src');
    el.watchVideoElement.innerHTML = '';
    el.watchNoticeToast.classList.add('hidden');
    el.watchSubSelect.innerHTML = '<option value="off">Off</option>';

    // Show Player Modal
    el.watchPlayerModal.classList.remove('hidden');

    try {
      const resp = await fetch(`/api/watch/video?path=${encodeURIComponent(videoPath)}`);
      if (!resp.ok) throw new Error("Could not load video details");
      const meta = await resp.json();
      state.watch.activeMetadata = meta;

      el.watchPlayerTitle.textContent = meta.filename || videoPath.split('/').pop();
      el.watchPlayerSub.textContent = meta.resolution ? `${meta.resolution} · ${formatBytes(meta.size)}` : formatBytes(meta.size);

      const isFav = meta.is_favorite || false;
      el.watchPlayerFavIcon.style.fill = isFav ? '#ff3b30' : 'none';
      el.watchPlayerFavIcon.style.color = isFav ? '#ff3b30' : 'currentColor';

      // Set video source
      const streamUrl = `/api/watch/stream?path=${encodeURIComponent(videoPath)}`;
      el.watchVideoElement.src = streamUrl;

      // Subtitles setup
      if (meta.subtitles && meta.subtitles.length > 0) {
        meta.subtitles.forEach((sub, idx) => {
          const trackUrl = `/api/watch/subtitles?path=${encodeURIComponent(sub.path)}`;
          const track = document.createElement('track');
          track.kind = 'subtitles';
          track.label = sub.label || `Track ${idx + 1}`;
          track.srclang = sub.lang || 'en';
          track.src = trackUrl;
          el.watchVideoElement.appendChild(track);

          const opt = document.createElement('option');
          opt.value = idx;
          opt.textContent = `${sub.label} (${sub.name})`;
          el.watchSubSelect.appendChild(opt);
        });
      }

      // Resume position setup
      const savedProg = meta.progress;
      if (savedProg && savedProg.position_seconds > 5 && savedProg.percent < 95) {
        const onLoaded = () => {
          el.watchVideoElement.currentTime = savedProg.position_seconds;
          showNoticeToast(`Resumed from ${formatDuration(savedProg.position_seconds)}`);
          el.watchVideoElement.removeEventListener('loadedmetadata', onLoaded);
        };
        el.watchVideoElement.addEventListener('loadedmetadata', onLoaded);
      }

      // Codec / container notice
      const ext = (meta.extension || '').toLowerCase();
      if (['.avi', '.mkv'].includes(ext)) {
        showNoticeToast(`Playback format ${ext.toUpperCase()}: Requires browser codec support`, 3500);
      }

      // Auto play
      el.watchVideoElement.play().catch(() => {});

      // Start periodic progress tracking (every 5 seconds)
      if (state.watch.progressInterval) clearInterval(state.watch.progressInterval);
      state.watch.progressInterval = setInterval(saveCurrentProgress, 5000);

    } catch (err) {
      showToast("Error opening video: " + err.message, "error");
    }
  }

  function closeWatchPlayer() {
    saveCurrentProgress();
    if (state.watch.progressInterval) {
      clearInterval(state.watch.progressInterval);
      state.watch.progressInterval = null;
    }

    el.watchVideoElement.pause();
    el.watchVideoElement.removeAttribute('src');
    el.watchVideoElement.load();
    el.watchPlayerModal.classList.add('hidden');
    state.watch.activeVideoPath = null;

    // Refresh Continue Watching row
    loadContinueWatching();
  }

  function saveCurrentProgress() {
    if (!state.watch.activeVideoPath || !el.watchVideoElement) return;
    const pos = el.watchVideoElement.currentTime;
    const dur = el.watchVideoElement.duration;

    if (pos && dur && dur > 0) {
      fetch('/api/watch/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: state.watch.activeVideoPath,
          position_seconds: pos,
          duration_seconds: dur
        })
      }).catch(() => {});
    }
  }

  // Player Controls Listeners
  if (el.watchSpeedSelect) {
    el.watchSpeedSelect.addEventListener('change', (e) => {
      el.watchVideoElement.playbackRate = parseFloat(e.target.value);
    });
  }

  if (el.watchSubSelect) {
    el.watchSubSelect.addEventListener('change', (e) => {
      const val = e.target.value;
      const tracks = el.watchVideoElement.textTracks;
      for (let i = 0; i < tracks.length; i++) {
        tracks[i].mode = (val !== 'off' && parseInt(val) === i) ? 'showing' : 'hidden';
      }
    });
  }

  if (el.watchPipBtn) {
    el.watchPipBtn.addEventListener('click', () => {
      if (document.pictureInPictureElement) {
        document.exitPictureInPicture().catch(() => {});
      } else if (el.watchVideoElement.requestPictureInPicture) {
        el.watchVideoElement.requestPictureInPicture().catch(() => {});
      }
    });
  }

  if (el.watchPlayerFavBtn) {
    el.watchPlayerFavBtn.addEventListener('click', async () => {
      if (!state.watch.activeVideoPath) return;
      const isCurrentlyFav = el.watchPlayerFavIcon.style.fill === 'rgb(255, 59, 48)' || el.watchPlayerFavIcon.style.fill === '#ff3b30';
      await toggleWatchFavorite(state.watch.activeVideoPath, !isCurrentlyFav);
      el.watchPlayerFavIcon.style.fill = !isCurrentlyFav ? '#ff3b30' : 'none';
      el.watchPlayerFavIcon.style.color = !isCurrentlyFav ? '#ff3b30' : 'currentColor';
    });
  }

  // Watch Player Keyboard Shortcuts
  document.addEventListener('keydown', (e) => {
    if (el.watchPlayerModal.classList.contains('hidden')) return;

    if (e.code === 'Space' || e.code === 'KeyK') {
      e.preventDefault();
      if (el.watchVideoElement.paused) el.watchVideoElement.play();
      else el.watchVideoElement.pause();
    } else if (e.code === 'KeyF') {
      e.preventDefault();
      if (document.fullscreenElement) document.exitFullscreen();
      else el.watchVideoElement.requestFullscreen().catch(() => {});
    } else if (e.code === 'KeyM') {
      e.preventDefault();
      el.watchVideoElement.muted = !el.watchVideoElement.muted;
    } else if (e.code === 'ArrowLeft' || e.code === 'KeyJ') {
      e.preventDefault();
      el.watchVideoElement.currentTime = Math.max(0, el.watchVideoElement.currentTime - 5);
      showNoticeToast("-5s");
    } else if (e.code === 'ArrowRight' || e.code === 'KeyL') {
      e.preventDefault();
      el.watchVideoElement.currentTime = Math.min(el.watchVideoElement.duration || 0, el.watchVideoElement.currentTime + 5);
      showNoticeToast("+5s");
    }
  });

  function showNoticeToast(msg, duration = 2000) {
    if (!el.watchNoticeToast) return;
    el.watchNoticeToast.textContent = msg;
    el.watchNoticeToast.classList.remove('hidden');
    setTimeout(() => {
      el.watchNoticeToast.classList.add('hidden');
    }, duration);
  }

  function formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) return '00:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    const mStr = String(m).padStart(2, '0');
    const sStr = String(s).padStart(2, '0');

    if (h > 0) {
      return `${h}:${mStr}:${sStr}`;
    }
    return `${mStr}:${sStr}`;
  }

  // ==========================================================================
  // File Action Operations
  // ==========================================================================

  function onSearchInput(query) {
    if (state.searchDebounceTimer) clearTimeout(state.searchDebounceTimer);
    state.searchDebounceTimer = setTimeout(() => {
      if (!query.trim()) {
        renderItems(state.items);
        return;
      }
      const q = query.toLowerCase();
      const filtered = state.items.filter(item => item.name.toLowerCase().includes(q));
      renderItems(filtered);
    }, 150);
  }

  function clearSearch() {
    if (el.searchInput) el.searchInput.value = '';
    if (el.mobileSearchInput) el.mobileSearchInput.value = '';
    if (el.clearSearchBtn) el.clearSearchBtn.classList.add('hidden');
    if (el.mobileClearSearchBtn) el.mobileClearSearchBtn.classList.add('hidden');
    renderItems(state.items);
  }

  function toggleViewMode() {
    state.viewMode = state.viewMode === 'list' ? 'grid' : 'list';
    localStorage.setItem('ff_view_mode', state.viewMode);
    setViewMode(state.viewMode);
    renderItems(state.items);
  }

  function setViewMode(mode) {
    if (el.fileContainer) {
      el.fileContainer.className = `file-container ${mode}-view`;
    }
  }

  function updateSortUI() {
    if (el.currentSortLabel) {
      const labelMap = { name: 'Name', mtime: 'Date', size: 'Size', type: 'Type' };
      el.currentSortLabel.textContent = labelMap[state.sortBy] || 'Sort';
    }
    if (el.toggleSortOrderBtn) {
      el.toggleSortOrderBtn.textContent = `Order: ${state.sortOrder === 'asc' ? 'Ascending' : 'Descending'}`;
    }
    if (el.sortDropdown) {
      el.sortDropdown.querySelectorAll('.dropdown-item[data-sort]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.sort === state.sortBy);
      });
    }
  }

  function toggleSelectAll(e) {
    const isChecked = e.target.checked;
    state.selectedPaths.clear();
    if (isChecked) {
      state.items.forEach(item => state.selectedPaths.add(item.path));
    }
    document.querySelectorAll('.item-checkbox').forEach(cb => {
      cb.checked = isChecked;
    });
    updateMultiSelectUI();
  }

  function updateMultiSelectUI() {
    const count = state.selectedPaths.size;
    if (el.multiActionBar) el.multiActionBar.classList.toggle('hidden', count === 0);
    if (el.selectedCountText) el.selectedCountText.textContent = `${count} selected`;
    if (el.selectAllCheckbox) el.selectAllCheckbox.checked = count > 0 && count === state.items.length;
  }

  function clearSelection() {
    state.selectedPaths.clear();
    document.querySelectorAll('.item-checkbox').forEach(cb => cb.checked = false);
    if (el.selectAllCheckbox) el.selectAllCheckbox.checked = false;
    updateMultiSelectUI();
  }

  // Multi Action Handlers
  function handleMultiDownload() {
    if (state.selectedPaths.size === 0) return;
    const pathsParam = Array.from(state.selectedPaths).map(p => encodeURIComponent(p)).join('&paths=');
    window.location.href = `/api/files/download-zip?paths=${pathsParam}`;
  }

  async function handleMultiDelete() {
    if (state.selectedPaths.size === 0) return;
    if (state.confirmDelete) {
      if (!confirm(`Delete ${state.selectedPaths.size} selected items?`)) return;
    }

    const paths = Array.from(state.selectedPaths);
    showLoading(true);

    try {
      const resp = await fetch('/api/files/batch-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths })
      });
      if (!resp.ok) throw new Error("Delete failed");
      showToast(`Deleted ${paths.length} items`);
      loadDirectory(state.currentPath, false);
    } catch (err) {
      showLoading(false);
      showToast(err.message, 'error');
    }
  }

  // Upload Logic
  async function handleFileUpload(e) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (el.uploadProgressPanel) el.uploadProgressPanel.classList.remove('hidden');
    if (el.uploadList) el.uploadList.innerHTML = '';

    const totalFiles = files.length;
    let completedFiles = 0;

    for (let i = 0; i < totalFiles; i++) {
      const file = files[i];
      const formData = new FormData();
      formData.append('file', file);
      formData.append('path', state.currentPath);

      const row = document.createElement('div');
      row.className = 'upload-item-row';
      row.innerHTML = `<span>${escapeHtml(file.name)}</span><span>Uploading...</span>`;
      el.uploadList.appendChild(row);

      try {
        const resp = await fetch('/api/files/upload', {
          method: 'POST',
          body: formData
        });
        if (!resp.ok) throw new Error("Failed");
        row.querySelector('span:last-child').textContent = 'Done';
      } catch (err) {
        row.querySelector('span:last-child').textContent = 'Error';
      }

      completedFiles++;
      if (el.uploadProgressFill) {
        el.uploadProgressFill.style.width = `${Math.round((completedFiles / totalFiles) * 100)}%`;
      }
    }

    showToast(`Uploaded ${completedFiles} files`);
    el.fileInput.value = '';
    loadDirectory(state.currentPath, false);
  }

  // Drag and Drop
  window.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (el.dropOverlay) el.dropOverlay.classList.remove('hidden');
  });

  window.addEventListener('dragleave', (e) => {
    if (e.relatedTarget === null && el.dropOverlay) {
      el.dropOverlay.classList.add('hidden');
    }
  });

  window.addEventListener('drop', (e) => {
    e.preventDefault();
    if (el.dropOverlay) el.dropOverlay.classList.add('hidden');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      el.fileInput.files = e.dataTransfer.files;
      handleFileUpload({ target: { files: e.dataTransfer.files } });
    }
  });

  // Prompt New Folder
  function promptNewFolder() {
    if (el.newFolderNameInput) el.newFolderNameInput.value = '';
    openModal(el.newFolderModal);
    setTimeout(() => el.newFolderNameInput.focus(), 100);
  }

  if (el.confirmNewFolderBtn) {
    el.confirmNewFolderBtn.addEventListener('click', async () => {
      const folderName = el.newFolderNameInput.value.trim();
      if (!folderName) return;

      closeModal(el.newFolderModal);
      showLoading(true);

      try {
        const resp = await fetch('/api/files/mkdir', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: state.currentPath ? `${state.currentPath}/${folderName}` : folderName
          })
        });
        if (!resp.ok) throw new Error("Couldn't create folder");
        showToast("Folder created");
        loadDirectory(state.currentPath, false);
      } catch (err) {
        showLoading(false);
        showToast(err.message, 'error');
      }
    });
  }

  // Context Menu Actions
  function showContextMenu(x, y, item) {
    state.activeContextItem = item;
    if (!el.contextMenu) return;

    if (el.contextMenuTitle) el.contextMenuTitle.textContent = item.name;

    el.contextMenu.style.left = `${Math.min(x, window.innerWidth - 190)}px`;
    el.contextMenu.style.top = `${Math.min(y, window.innerHeight - 220)}px`;
    el.contextMenu.classList.remove('hidden');
  }

  function hideContextMenu() {
    if (el.contextMenu) el.contextMenu.classList.add('hidden');
  }

  document.addEventListener('click', hideContextMenu);

  if (el.contextMenu) {
    el.contextMenu.querySelectorAll('.menu-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        hideContextMenu();
        const action = btn.dataset.action;
        const item = state.activeContextItem;
        if (!item) return;

        if (action === 'open') {
          if (item.is_dir) loadDirectory(item.path);
          else openFilePreview(item);
        } else if (action === 'download') {
          window.location.href = `/api/files/download?path=${encodeURIComponent(item.path)}`;
        } else if (action === 'rename') {
          promptRename(item);
        } else if (action === 'share') {
          promptShare(item);
        } else if (action === 'properties') {
          showProperties(item);
        } else if (action === 'delete') {
          confirmDeleteItem(item);
        }
      });
    });
  }

  function promptRename(item) {
    if (el.renameItemInput) el.renameItemInput.value = item.name;
    openModal(el.renameModal);
  }

  if (el.confirmRenameBtn) {
    el.confirmRenameBtn.addEventListener('click', async () => {
      const newName = el.renameItemInput.value.trim();
      const item = state.activeContextItem;
      if (!newName || !item) return;

      closeModal(el.renameModal);
      showLoading(true);

      const parentDir = item.path.includes('/') ? item.path.substring(0, item.path.lastIndexOf('/')) : '';
      const newPath = parentDir ? `${parentDir}/${newName}` : newName;

      try {
        const resp = await fetch('/api/files/rename', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ old_path: item.path, new_path: newPath })
        });
        if (!resp.ok) throw new Error("Rename failed");
        showToast("Renamed successfully");
        loadDirectory(state.currentPath, false);
      } catch (err) {
        showLoading(false);
        showToast(err.message, 'error');
      }
    });
  }

  async function confirmDeleteItem(item) {
    if (state.confirmDelete) {
      if (!confirm(`Delete "${item.name}"?`)) return;
    }
    showLoading(true);

    try {
      const resp = await fetch('/api/files/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: item.path })
      });
      if (!resp.ok) throw new Error("Delete failed");
      showToast("Item deleted");
      loadDirectory(state.currentPath, false);
    } catch (err) {
      showLoading(false);
      showToast(err.message, 'error');
    }
  }

  function showProperties(item) {
    if (el.propName) el.propName.textContent = item.name;
    if (el.propType) el.propType.textContent = item.is_dir ? 'Folder' : (item.extension || 'File');
    if (el.propSize) el.propSize.textContent = item.is_dir ? '—' : formatBytes(item.size);
    if (el.propPath) el.propPath.textContent = item.path;
    if (el.propMtime) el.propMtime.textContent = formatDate(item.mtime);
    openModal(el.propertiesModal);
  }

  function promptShare(item) {
    if (el.shareItemName) el.shareItemName.textContent = `Sharing: ${item.name}`;
    if (el.sharePasswordInput) el.sharePasswordInput.value = '';
    if (el.shareResultArea) el.shareResultArea.classList.add('hidden');
    openModal(el.shareModal);
  }

  if (el.confirmShareBtn) {
    el.confirmShareBtn.addEventListener('click', async () => {
      const item = state.activeContextItem;
      if (!item) return;

      const password = el.sharePasswordInput.value.trim() || null;
      const expireVal = el.shareExpireSelect.value;
      const expiresInSeconds = expireVal ? parseInt(expireVal) : null;

      try {
        const resp = await fetch('/api/shares/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: item.path,
            password: password,
            expires_in_seconds: expiresInSeconds
          })
        });
        if (!resp.ok) throw new Error("Share link creation failed");
        const data = await resp.json();

        const shareUrl = `${window.location.origin}/api/shares/get/${data.id}`;
        if (el.shareUrlOutput) el.shareUrlOutput.value = shareUrl;
        if (el.shareResultArea) el.shareResultArea.classList.remove('hidden');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  if (el.copyShareUrlBtn) {
    el.copyShareUrlBtn.addEventListener('click', () => {
      if (el.shareUrlOutput) {
        navigator.clipboard.writeText(el.shareUrlOutput.value);
        showToast("Share link copied to clipboard");
      }
    });
  }

  // File Preview
  function openFilePreview(item) {
    if (!el.previewModal || !el.previewBody) return;
    if (el.previewTitle) el.previewTitle.textContent = item.name;
    el.previewBody.innerHTML = '';

    const streamUrl = `/api/files/download?path=${encodeURIComponent(item.path)}`;
    const ext = (item.extension || '').toLowerCase();
    const mime = item.mime_type || '';

    if (mime.startsWith('image/') || ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'].includes(ext)) {
      const img = document.createElement('img');
      img.src = streamUrl;
      el.previewBody.appendChild(img);
    } else if (mime.startsWith('video/') || ['.mp4', '.webm', '.mkv', '.mov', '.avi'].includes(ext)) {
      // If user clicks video file in file browser, route cleanly to Watch player!
      openWatchPlayer(item.path);
      return;
    } else if (mime.startsWith('audio/') || ['.mp3', '.flac', '.wav', '.ogg'].includes(ext)) {
      const audio = document.createElement('audio');
      audio.controls = true;
      audio.src = streamUrl;
      el.previewBody.appendChild(audio);
    } else {
      // Text / Code preview
      fetch(streamUrl)
        .then(r => r.text())
        .then(txt => {
          const pre = document.createElement('pre');
          pre.textContent = txt.slice(0, 100000);
          el.previewBody.appendChild(pre);
        })
        .catch(() => {
          el.previewBody.textContent = 'Preview not available for this file type.';
        });
    }

    openModal(el.previewModal);
  }

  // Settings & Theme
  function initTheme(themeName) {
    if (themeName === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    } else {
      document.documentElement.setAttribute('data-theme', themeName);
    }
  }

  function initSettingsUI() {
    if (el.showHiddenToggle) {
      el.showHiddenToggle.checked = state.showHidden;
      el.showHiddenToggle.addEventListener('change', (e) => {
        state.showHidden = e.target.checked;
        localStorage.setItem('ff_show_hidden', state.showHidden);
        loadDirectory(state.currentPath, false);
      });
    }

    if (el.confirmDeleteToggle) {
      el.confirmDeleteToggle.checked = state.confirmDelete;
      el.confirmDeleteToggle.addEventListener('change', (e) => {
        state.confirmDelete = e.target.checked;
        localStorage.setItem('ff_confirm_delete', state.confirmDelete);
      });
    }

    document.querySelectorAll('.theme-option').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.themeVal === state.theme);
      btn.addEventListener('click', () => {
        state.theme = btn.dataset.themeVal;
        localStorage.setItem('ff_theme', state.theme);
        document.querySelectorAll('.theme-option').forEach(b => b.classList.toggle('active', b === btn));
        initTheme(state.theme);
      });
    });

    document.querySelectorAll('[data-view-val]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.viewVal === state.viewMode);
      btn.addEventListener('click', () => {
        state.viewMode = btn.dataset.viewVal;
        localStorage.setItem('ff_view_mode', state.viewMode);
        document.querySelectorAll('[data-view-val]').forEach(b => b.classList.toggle('active', b === btn));
        setViewMode(state.viewMode);
        renderItems(state.items);
      });
    });
  }

  async function fetchStorageInfo() {
    try {
      const resp = await fetch('/api/storage/info');
      if (!resp.ok) return;
      const data = await resp.json();
      if (el.settingsStorageDetails) {
        el.settingsStorageDetails.textContent = `${formatBytes(data.used_bytes)} of ${formatBytes(data.total_bytes)}`;
      }
      if (el.settingsStoragePercent) {
        el.settingsStoragePercent.textContent = `${data.used_percent}%`;
      }
    } catch (e) {}
  }

  // Modal Helpers
  function openModal(modalEl) {
    if (modalEl) modalEl.classList.remove('hidden');
  }

  function closeModal(modalEl) {
    if (modalEl) modalEl.classList.add('hidden');
  }

  function closeAllModals() {
    document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.add('hidden'));
  }

  // State Helpers
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
