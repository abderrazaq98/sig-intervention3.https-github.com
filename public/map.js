const map = L.map('map').setView([35.5785, -5.3684], 9); // Centré par défaut sur le Nord Maroc

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors',
  maxZoom: 19,
}).addTo(map);

const markersLayer = L.layerGroup().addTo(map);
let allMarkers = new Map(); // id -> marker

// ---------- Légende ----------
const legend = L.control({ position: 'bottomright' });
legend.onAdd = function () {
  const div = L.DomUtil.create('div', 'map-legend');
  div.innerHTML = `
    <div class="legend-item">
      <span class="legend-dot"></span>
      <span>Identifiant géographique</span>
    </div>
  `;
  return div;
};
legend.addTo(map);

function clearMarkers() {
  markersLayer.clearLayers();
  allMarkers.clear();
}

function addPointMarker(p) {
  if (p.lat == null || p.lng == null) return null;
  const marker = L.marker([p.lat, p.lng]).addTo(markersLayer);
  const gmapsLink = `https://www.google.com/maps?q=${p.lat},${p.lng}`;
  marker.bindPopup(`
    <b>Identifiant géographique:</b> ${p.ig || '—'}<br>
    <b>Adresse:</b> ${p.adresse || '—'}<br>
    ${p.numero_batiment ? `<b>N° Bâtiment:</b> ${p.numero_batiment}<br>` : ''}
    ${p.secteur_numero ? `<b>Secteur n°:</b> ${p.secteur_numero}<br>` : ''}
    <b>Coordonnées:</b> ${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}
    ${p.commentaire ? `<br><b>Note:</b> ${p.commentaire}` : ''}
    <br><a href="${gmapsLink}" target="_blank" rel="noopener">Ouvrir dans Google Maps</a>
  `);
  allMarkers.set(p.id, marker);
  return marker;
}

async function loadInitialPoints() {
  try {
    const res = await fetch('/api/points?limit=1000');
    const points = await res.json();
    clearMarkers();
    points.forEach(addPointMarker);
  } catch (e) {
    console.error('Erreur de chargement des points', e);
  }
}

function renderResults(points) {
  const panel = document.getElementById('resultsPanel');
  const list = document.getElementById('resultsList');
  const count = document.getElementById('resultsCount');

  count.textContent = `${points.length} résultat(s)`;
  list.innerHTML = '';

  if (points.length === 0) {
    list.innerHTML = '<div class="result-item">Aucun point trouvé.</div>';
  }

  points.forEach((p) => {
    const div = document.createElement('div');
    div.className = 'result-item';
    const gmapsLink = (p.lat != null && p.lng != null) ? `https://www.google.com/maps?q=${p.lat},${p.lng}` : '';
    div.innerHTML = `
      <div class="ig">${p.ig || 'Sans IG'}</div>
      <div class="adresse">${p.adresse || 'Adresse inconnue'}</div>
      ${gmapsLink ? '<button class="copy-gmaps-btn" style="margin-top:4px; padding:3px 8px; font-size:0.8rem; cursor:pointer;">Copier le lien Google Maps</button>' : ''}
    `;
    div.addEventListener('click', (e) => {
      if (e.target.classList.contains('copy-gmaps-btn')) return; // géré séparément ci-dessous
      if (p.lat != null && p.lng != null) {
        map.setView([p.lat, p.lng], 17);
        const marker = allMarkers.get(p.id);
        if (marker) marker.openPopup();
      }
    });
    const copyBtn = div.querySelector('.copy-gmaps-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        navigator.clipboard?.writeText(gmapsLink).then(() => {
          copyBtn.textContent = 'Lien copié !';
          setTimeout(() => { copyBtn.textContent = 'Copier le lien Google Maps'; }, 1500);
        }).catch(() => {
          alert('Lien : ' + gmapsLink);
        });
      });
    }
    list.appendChild(div);
  });

  panel.classList.remove('hidden');
}

async function performSearch() {
  const type = document.getElementById('searchType').value;
  const q = document.getElementById('searchInput').value.trim();
  const status = document.getElementById('searchStatus');

  if (!q) {
    status.textContent = 'Saisissez un terme de recherche.';
    return;
  }

  status.textContent = 'Recherche...';

  try {
    const url = `/api/points?q=${encodeURIComponent(q)}&type=${type}&limit=100`;
    const res = await fetch(url);
    if (!res.ok) {
      const err = await res.json();
      status.textContent = err.error || 'Erreur de recherche';
      return;
    }
    const points = await res.json();
    status.textContent = '';

    clearMarkers();
    points.forEach(addPointMarker);
    renderResults(points);

    if (points.length === 1 && points[0].lat != null) {
      map.setView([points[0].lat, points[0].lng], 17);
      allMarkers.get(points[0].id)?.openPopup();
    } else if (points.length > 1) {
      const group = L.featureGroup([...allMarkers.values()]);
      if (group.getLayers().length) map.fitBounds(group.getBounds().pad(0.2));
    }
  } catch (e) {
    status.textContent = 'Erreur réseau';
    console.error(e);
  }
}

document.getElementById('searchBtn').addEventListener('click', performSearch);
document.getElementById('searchInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') performSearch();
});
document.getElementById('closeResults').addEventListener('click', () => {
  document.getElementById('resultsPanel').classList.add('hidden');
  loadInitialPoints();
});

loadInitialPoints();
