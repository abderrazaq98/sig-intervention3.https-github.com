let currentPage = 0;
const PAGE_SIZE = 50;
let allPoints = [];
let filteredPoints = [];
let selectedIds = new Set();

// ---------- Auth ----------
async function checkSession() {
  const res = await fetch('/api/session');
  const data = await res.json();
  if (data.isAdmin) {
    showAdmin();
  } else {
    showLogin();
  }
}

function showLogin() {
  document.getElementById('loginView').classList.remove('hidden');
  document.getElementById('adminView').classList.add('hidden');
}

function showAdmin() {
  document.getElementById('loginView').classList.add('hidden');
  document.getElementById('adminView').classList.remove('hidden');
  loadPoints();
}

document.getElementById('loginBtn').addEventListener('click', async () => {
  const password = document.getElementById('passwordInput').value;
  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (res.ok) {
    showAdmin();
  } else {
    document.getElementById('loginError').textContent = 'Mot de passe incorrect';
  }
});

document.getElementById('passwordInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('loginBtn').click();
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST' });
  showLogin();
});

// ---------- Chargement / affichage des points ----------
async function loadPoints() {
  const res = await fetch('/api/points?limit=2000');
  allPoints = await res.json();
  filteredPoints = allPoints;
  currentPage = 0;
  selectedIds.clear();
  updateSelectionUI();
  renderTable();
}

function renderTable() {
  const tbody = document.getElementById('pointsTableBody');
  tbody.innerHTML = '';

  const start = currentPage * PAGE_SIZE;
  const pagePoints = filteredPoints.slice(start, start + PAGE_SIZE);

  pagePoints.forEach((p) => {
    const tr = document.createElement('tr');
    if (selectedIds.has(p.id)) tr.classList.add('selected-row');
    tr.innerHTML = `
      <td><input type="checkbox" class="row-checkbox" data-id="${p.id}" ${selectedIds.has(p.id) ? 'checked' : ''}/></td>
      <td>${p.id}</td>
      <td>${p.ig || ''}</td>
      <td>${p.adresse || ''}</td>
      <td>${p.numero_batiment || ''}</td>
      <td>${p.secteur_numero || ''}</td>
      <td>${p.x != null ? p.x.toFixed(2) : ''}</td>
      <td>${p.y != null ? p.y.toFixed(2) : ''}</td>
      <td>${p.lat != null ? p.lat.toFixed(6) : ''}</td>
      <td>${p.lng != null ? p.lng.toFixed(6) : ''}</td>
      <td>
        <button class="btn" data-edit="${p.id}" style="padding:4px 10px;">Modifier</button>
        <button class="btn danger" data-del="${p.id}" style="padding:4px 10px;">Supprimer</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  document.querySelectorAll('[data-edit]').forEach((btn) => {
    btn.addEventListener('click', () => openEditModal(Number(btn.dataset.edit)));
  });
  document.querySelectorAll('[data-del]').forEach((btn) => {
    btn.addEventListener('click', () => deletePoint(Number(btn.dataset.del)));
  });
  document.querySelectorAll('.row-checkbox').forEach((cb) => {
    cb.addEventListener('change', () => {
      const id = Number(cb.dataset.id);
      if (cb.checked) {
        selectedIds.add(id);
      } else {
        selectedIds.delete(id);
      }
      cb.closest('tr').classList.toggle('selected-row', cb.checked);
      updateSelectionUI();
    });
  });

  const totalPages = Math.max(1, Math.ceil(filteredPoints.length / PAGE_SIZE));
  document.getElementById('pageInfo').textContent = `Page ${currentPage + 1} / ${totalPages} (${filteredPoints.length} points)`;
  document.getElementById('prevPage').disabled = currentPage === 0;
  document.getElementById('nextPage').disabled = currentPage >= totalPages - 1;

  const headerCb = document.getElementById('headerCheckbox');
  headerCb.checked = pagePoints.length > 0 && pagePoints.every((p) => selectedIds.has(p.id));
}

document.getElementById('prevPage').addEventListener('click', () => {
  if (currentPage > 0) { currentPage--; renderTable(); }
});
document.getElementById('nextPage').addEventListener('click', () => {
  const totalPages = Math.ceil(filteredPoints.length / PAGE_SIZE);
  if (currentPage < totalPages - 1) { currentPage++; renderTable(); }
});

function applyFilter() {
  const type = document.getElementById('filterType').value;
  const q = document.getElementById('filterInput').value.toLowerCase().trim();

  if (!q) {
    filteredPoints = allPoints;
  } else if (type === 'ig') {
    filteredPoints = allPoints.filter((p) => (p.ig || '').toLowerCase().includes(q));
  } else if (type === 'adresse') {
    filteredPoints = allPoints.filter((p) => (p.adresse || '').toLowerCase().includes(q));
  } else if (type === 'batiment') {
    filteredPoints = allPoints.filter((p) => (p.numero_batiment || '').toLowerCase().includes(q));
  } else {
    filteredPoints = allPoints.filter((p) =>
      (p.ig || '').toLowerCase().includes(q) ||
      (p.adresse || '').toLowerCase().includes(q) ||
      (p.numero_batiment || '').toLowerCase().includes(q));
  }
  currentPage = 0;
  renderTable();
}

document.getElementById('filterInput').addEventListener('input', applyFilter);
document.getElementById('filterType').addEventListener('change', applyFilter);

// ---------- Sélection ----------
function updateSelectionUI() {
  const info = document.getElementById('selectionInfo');
  info.textContent = selectedIds.size > 0 ? `${selectedIds.size} point(s) sélectionné(s)` : '';

  const gmapsBar = document.getElementById('gmapsLinkBar');
  if (selectedIds.size === 1) {
    const id = [...selectedIds][0];
    const p = allPoints.find((pt) => pt.id === id);
    if (p && p.lat != null && p.lng != null) {
      document.getElementById('gmapsLinkInput').value = `https://www.google.com/maps?q=${p.lat},${p.lng}`;
      gmapsBar.classList.remove('hidden');
    } else {
      gmapsBar.classList.add('hidden');
    }
  } else {
    gmapsBar.classList.add('hidden');
  }
}

document.getElementById('headerCheckbox').addEventListener('change', (e) => {
  const start = currentPage * PAGE_SIZE;
  const pagePoints = filteredPoints.slice(start, start + PAGE_SIZE);
  pagePoints.forEach((p) => {
    if (e.target.checked) selectedIds.add(p.id);
    else selectedIds.delete(p.id);
  });
  updateSelectionUI();
  renderTable();
});

document.getElementById('selectAllBtn').addEventListener('click', () => {
  filteredPoints.forEach((p) => selectedIds.add(p.id));
  updateSelectionUI();
  renderTable();
});

document.getElementById('deselectAllBtn').addEventListener('click', () => {
  selectedIds.clear();
  updateSelectionUI();
  renderTable();
});

document.getElementById('gmapsCopyBtn').addEventListener('click', () => {
  const input = document.getElementById('gmapsLinkInput');
  input.select();
  navigator.clipboard?.writeText(input.value).catch(() => document.execCommand('copy'));
});

document.getElementById('deleteSelectedBtn').addEventListener('click', async () => {
  if (selectedIds.size === 0) {
    alert('Aucun point sélectionné.');
    return;
  }
  if (!confirm(`Supprimer ${selectedIds.size} point(s) sélectionné(s) ? Cette action est irréversible.`)) return;

  const res = await fetch('/api/points', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids: [...selectedIds] }),
  });
  if (res.ok) {
    loadPoints();
  } else {
    alert('Erreur lors de la suppression groupée');
  }
});

// ---------- Zoom sur la sélection (mini-carte admin) ----------
let adminMap = null;
let adminMarkers = new Map();

function initAdminMap() {
  if (adminMap) return;
  adminMap = L.map('adminMap').setView([35.5785, -5.3684], 9);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  }).addTo(adminMap);
}

document.getElementById('zoomSelectedBtn').addEventListener('click', () => {
  if (selectedIds.size === 0) {
    alert('Sélectionnez au moins un point pour zoomer.');
    return;
  }
  const mapDiv = document.getElementById('adminMap');
  mapDiv.style.display = 'block';
  initAdminMap();
  setTimeout(() => adminMap.invalidateSize(), 50);

  adminMarkers.forEach((m) => adminMap.removeLayer(m));
  adminMarkers.clear();

  const selectedPoints = allPoints.filter((p) => selectedIds.has(p.id) && p.lat != null && p.lng != null);
  selectedPoints.forEach((p) => {
    const marker = L.marker([p.lat, p.lng]).addTo(adminMap);
    marker.bindPopup(`<b>IG:</b> ${p.ig || '—'}<br><b>Adresse:</b> ${p.adresse || '—'}`);
    adminMarkers.set(p.id, marker);
  });

  if (selectedPoints.length === 1) {
    adminMap.setView([selectedPoints[0].lat, selectedPoints[0].lng], 18);
    adminMarkers.get(selectedPoints[0].id).openPopup();
  } else if (selectedPoints.length > 1) {
    const group = L.featureGroup([...adminMarkers.values()]);
    adminMap.fitBounds(group.getBounds().pad(0.2));
  } else {
    alert('Les points sélectionnés n\'ont pas de coordonnées valides.');
  }
});

// ---------- Mini-carte de sélection d'emplacement (modal ajout/édition) ----------
let pickerMap = null;
let pickerMarker = null;

function initPickerMap() {
  if (pickerMap) return;
  pickerMap = L.map('pickerMap').setView([35.5785, -5.3684], 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  }).addTo(pickerMap);

  pickerMap.on('click', (e) => {
    setPickerLocation(e.latlng.lat, e.latlng.lng);
  });
}

function setPickerLocation(lat, lng) {
  document.getElementById('fLat').value = lat;
  document.getElementById('fLng').value = lng;

  if (pickerMarker) {
    pickerMarker.setLatLng([lat, lng]);
  } else {
    pickerMarker = L.marker([lat, lng], { draggable: true }).addTo(pickerMap);
    pickerMarker.on('dragend', () => {
      const pos = pickerMarker.getLatLng();
      setPickerLocation(pos.lat, pos.lng);
    });
  }

  fetch('/api/convert-coords?lat=' + lat + '&lng=' + lng)
    .then((r) => r.ok ? r.json() : null)
    .then((data) => {
      if (data && data.x != null) {
        document.getElementById('fX').value = data.x;
        document.getElementById('fY').value = data.y;
        document.getElementById('fXDisplay').textContent = data.x.toFixed(2);
        document.getElementById('fYDisplay').textContent = data.y.toFixed(2);
      }
    })
    .catch(() => {});
}

function resetPickerMap(existingLat, existingLng) {
  initPickerMap();
  setTimeout(() => pickerMap.invalidateSize(), 100);

  if (pickerMarker) {
    pickerMap.removeLayer(pickerMarker);
    pickerMarker = null;
  }
  document.getElementById('fXDisplay').textContent = '—';
  document.getElementById('fYDisplay').textContent = '—';
  document.getElementById('fX').value = '';
  document.getElementById('fY').value = '';
  document.getElementById('fLat').value = '';
  document.getElementById('fLng').value = '';

  if (existingLat != null && existingLng != null) {
    pickerMap.setView([existingLat, existingLng], 16);
    setPickerLocation(existingLat, existingLng);
  } else {
    pickerMap.setView([35.5785, -5.3684], 12);
  }
}

// ---------- Modal ajout / édition ----------
function openAddModal() {
  document.getElementById('modalTitle').textContent = 'Ajouter un point';
  document.getElementById('editId').value = '';
  document.getElementById('fIg').value = '';
  document.getElementById('fAdresse').value = '';
  document.getElementById('fNumBatiment').value = '';
  document.getElementById('fSecteurNumero').value = '';
  document.getElementById('fSecteurNom').value = '';
  document.getElementById('fCommentaire').value = '';
  document.getElementById('modalError').textContent = '';
  document.getElementById('modalOverlay').classList.remove('hidden');
  resetPickerMap(null, null);
}

function openEditModal(id) {
  const p = allPoints.find((pt) => pt.id === id);
  if (!p) return;
  document.getElementById('modalTitle').textContent = `Modifier le point #${id}`;
  document.getElementById('editId').value = id;
  document.getElementById('fIg').value = p.ig || '';
  document.getElementById('fAdresse').value = p.adresse || '';
  document.getElementById('fNumBatiment').value = p.numero_batiment || '';
  document.getElementById('fSecteurNumero').value = p.secteur_numero || '';
  document.getElementById('fSecteurNom').value = p.secteur_nom || '';
  document.getElementById('fCommentaire').value = p.commentaire || '';
  document.getElementById('modalError').textContent = '';
  document.getElementById('modalOverlay').classList.remove('hidden');
  resetPickerMap(p.lat, p.lng);
}

document.getElementById('addBtn').addEventListener('click', openAddModal);
document.getElementById('modalCancel').addEventListener('click', () => {
  document.getElementById('modalOverlay').classList.add('hidden');
});

document.getElementById('modalSave').addEventListener('click', async () => {
  const id = document.getElementById('editId').value;
  const lat = parseFloat(document.getElementById('fLat').value);
  const lng = parseFloat(document.getElementById('fLng').value);

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    document.getElementById('modalError').textContent = 'Cliquez sur la carte pour choisir l\'emplacement du point.';
    return;
  }

  if (!confirm(id ? 'Confirmer la modification de ce point ?' : 'Confirmer l\'ajout de ce point ?')) {
    return;
  }

  const payload = {
    ig: document.getElementById('fIg').value.trim(),
    adresse: document.getElementById('fAdresse').value.trim(),
    numero_batiment: document.getElementById('fNumBatiment').value.trim(),
    secteur_numero: document.getElementById('fSecteurNumero').value.trim(),
    secteur_nom: document.getElementById('fSecteurNom').value.trim(),
    lat,
    lng,
    commentaire: document.getElementById('fCommentaire').value.trim(),
  };

  const url = id ? `/api/points/${id}` : '/api/points';
  const method = id ? 'PUT' : 'POST';

  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (res.ok) {
    document.getElementById('modalOverlay').classList.add('hidden');
    loadPoints();
  } else {
    const err = await res.json();
    document.getElementById('modalError').textContent = err.error || 'Erreur lors de l\'enregistrement';
  }
});

async function deletePoint(id) {
  if (!confirm(`Supprimer le point #${id} ? Cette action est irréversible.`)) return;
  const res = await fetch(`/api/points/${id}`, { method: 'DELETE' });
  if (res.ok) {
    loadPoints();
  } else {
    alert('Erreur lors de la suppression');
  }
}

// ---------- Imports (Excel / SHP / KML) avec confirmation ----------
function runImport(inputEl, endpoint, label) {
  inputEl.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!confirm(`Importer le fichier "${file.name}" (${label}) ? Cette action va ajouter des points à la base de données.`)) {
      e.target.value = '';
      return;
    }

    const status = document.getElementById('importStatus');
    status.textContent = 'Import en cours...';

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(endpoint, { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok) {
        status.textContent = `Import ${label} terminé : ${data.imported} point(s) importé(s), ${data.errors} erreur(s) sur ${data.total} lignes.`;
        loadPoints();
      } else {
        status.textContent = 'Erreur : ' + (data.error || 'import échoué');
      }
    } catch (err) {
      status.textContent = 'Erreur réseau pendant l\'import';
    }
    e.target.value = '';
  });
}

runImport(document.getElementById('importFile'), '/api/import', 'Excel');
runImport(document.getElementById('importShpFile'), '/api/import-shp', 'SHP');
runImport(document.getElementById('importKmlFile'), '/api/import-kml', 'KML');

checkSession();
