const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const db = require('../db');
const { lambertToWGS84, wgs84ToLambert } = require('../coords');
const { requireAuth } = require('../auth');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

function rowToPublic(row) {
  return {
    id: row.id,
    ig: row.ig,
    adresse: row.adresse,
    numero_batiment: row.numero_batiment,
    secteur_nom: row.secteur_nom,
    secteur_numero: row.secteur_numero,
    x: row.x,
    y: row.y,
    lat: row.lat,
    lng: row.lng,
    commentaire: row.commentaire,
  };
}

// Normalise un nom de colonne (insensible à la casse / accents) — utilisé par
// les imports Excel / SHP / KML pour reconnaître les différentes variantes.
function normalizeKey(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

// ---- Conversion GPS -> Lambert (utilisé par la mini-carte de sélection en admin) ----
router.get('/convert-coords', requireAuth, (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return res.status(400).json({ error: 'lat et lng requis' });
  }
  const { x, y } = wgs84ToLambert(lat, lng);
  res.json({ x, y });
});

// ---- Recherche / liste publique ----
// GET /api/points?q=...&type=ig|adresse|coord&limit=...
router.get('/points', (req, res) => {
  const { q, type, limit } = req.query;
  const max = Math.min(Number(limit) || 200, 2000);

  let rows;
  if (!q) {
    const stmt = db.prepare('SELECT * FROM points ORDER BY id DESC LIMIT ?');
    rows = stmt.all(max);
  } else if (type === 'coord') {
    // Recherche par coordonnées : "lat, lng" -> renvoie les points les plus proches
    const parts = q.split(',').map((s) => parseFloat(s.trim()));
    if (parts.length !== 2 || parts.some(Number.isNaN)) {
      return res.status(400).json({ error: 'Format attendu: "lat, lng"' });
    }
    const [lat, lng] = parts;
    const stmt = db.prepare(`
      SELECT *, ((lat - ?) * (lat - ?) + (lng - ?) * (lng - ?)) AS dist
      FROM points
      ORDER BY dist ASC
      LIMIT ?
    `);
    rows = stmt.all(lat, lat, lng, lng, max);
  } else if (type === 'ig') {
    const stmt = db.prepare('SELECT * FROM points WHERE ig LIKE ? ORDER BY id DESC LIMIT ?');
    rows = stmt.all(`%${q}%`, max);
  } else if (type === 'adresse') {
    const stmt = db.prepare('SELECT * FROM points WHERE adresse LIKE ? ORDER BY id DESC LIMIT ?');
    rows = stmt.all(`%${q}%`, max);
  } else if (type === 'batiment') {
    const stmt = db.prepare('SELECT * FROM points WHERE numero_batiment LIKE ? ORDER BY id DESC LIMIT ?');
    rows = stmt.all(`%${q}%`, max);
  } else {
    // recherche libre sur IG + adresse + numéro de bâtiment
    const stmt = db.prepare('SELECT * FROM points WHERE ig LIKE ? OR adresse LIKE ? OR numero_batiment LIKE ? ORDER BY id DESC LIMIT ?');
    rows = stmt.all(`%${q}%`, `%${q}%`, `%${q}%`, max);
  }

  res.json(rows.map(rowToPublic));
});

router.get('/points/:id', (req, res) => {
  const stmt = db.prepare('SELECT * FROM points WHERE id = ?');
  const row = stmt.get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Point introuvable' });
  res.json(rowToPublic(row));
});

// ---- Admin : création / modification / suppression (protégées) ----

router.post('/points', requireAuth, (req, res) => {
  const { ig, adresse, numero_batiment, secteur_nom, secteur_numero, x, y, lat, lng, commentaire } = req.body;

  let finalLat = lat;
  let finalLng = lng;
  let finalX = x;
  let finalY = y;

  if ((finalLat == null || finalLng == null) && x != null && y != null) {
    const conv = lambertToWGS84(x, y);
    finalLat = conv.lat;
    finalLng = conv.lng;
  } else if ((finalX == null || finalY == null) && lat != null && lng != null) {
    const conv = wgs84ToLambert(lat, lng);
    finalX = conv.x;
    finalY = conv.y;
  }

  const stmt = db.prepare(`
    INSERT INTO points (ig, adresse, numero_batiment, secteur_nom, secteur_numero, x, y, lat, lng, commentaire)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const info = stmt.run(
    ig || null,
    adresse || null,
    numero_batiment || null,
    secteur_nom || null,
    secteur_numero || null,
    finalX ?? null,
    finalY ?? null,
    finalLat ?? null,
    finalLng ?? null,
    commentaire || null
  );

  const created = db.prepare('SELECT * FROM points WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(rowToPublic(created));
});

router.put('/points/:id', requireAuth, (req, res) => {
  const existing = db.prepare('SELECT * FROM points WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Point introuvable' });

  const { ig, adresse, numero_batiment, secteur_nom, secteur_numero, x, y, lat, lng, commentaire } = req.body;

  let finalLat = lat ?? existing.lat;
  let finalLng = lng ?? existing.lng;
  let finalX = x ?? existing.x;
  let finalY = y ?? existing.y;

  // Si x/y ont changé, recalculer lat/lng ; si lat/lng ont changé, recalculer x/y
  if (x != null && y != null && (x !== existing.x || y !== existing.y)) {
    const conv = lambertToWGS84(x, y);
    finalLat = conv.lat;
    finalLng = conv.lng;
  } else if (lat != null && lng != null && (lat !== existing.lat || lng !== existing.lng)) {
    const conv = wgs84ToLambert(lat, lng);
    finalX = conv.x;
    finalY = conv.y;
  }

  const stmt = db.prepare(`
    UPDATE points SET ig = ?, adresse = ?, numero_batiment = ?, secteur_nom = ?, secteur_numero = ?, x = ?, y = ?, lat = ?, lng = ?, commentaire = ?, date_modification = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  stmt.run(
    ig ?? existing.ig,
    adresse ?? existing.adresse,
    numero_batiment ?? existing.numero_batiment,
    secteur_nom ?? existing.secteur_nom,
    secteur_numero ?? existing.secteur_numero,
    finalX ?? null,
    finalY ?? null,
    finalLat ?? null,
    finalLng ?? null,
    commentaire ?? existing.commentaire,
    req.params.id
  );

  const updated = db.prepare('SELECT * FROM points WHERE id = ?').get(req.params.id);
  res.json(rowToPublic(updated));
});

router.delete('/points/:id', requireAuth, (req, res) => {
  const stmt = db.prepare('DELETE FROM points WHERE id = ?');
  const info = stmt.run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Point introuvable' });
  res.json({ success: true });
});

// ---- Suppression groupée (bouton "Supprimer la sélection" en admin) ----
// DELETE /api/points  body: { ids: [1, 2, 3] }
router.delete('/points', requireAuth, (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Aucun identifiant fourni' });
  }
  const stmt = db.prepare('DELETE FROM points WHERE id = ?');
  let deleted = 0;
  db.exec('BEGIN');
  try {
    for (const id of ids) {
      const info = stmt.run(id);
      deleted += info.changes;
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    return res.status(500).json({ error: 'Erreur pendant la suppression: ' + e.message });
  }
  res.json({ success: true, deleted });
});

// ---- Import Excel en masse (admin) ----
// Colonnes attendues (insensible à la casse) : IG, Adresse, X, Y
router.post('/import', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu' });

  let workbook;
  try {
    workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
  } catch (e) {
    return res.status(400).json({ error: 'Fichier Excel illisible' });
  }

  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });

  if (rows.length === 0) {
    return res.status(400).json({ error: 'Le fichier ne contient aucune ligne' });
  }

  const insert = db.prepare(`
    INSERT INTO points (ig, adresse, numero_batiment, secteur_nom, secteur_numero, x, y, lat, lng)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let imported = 0;
  let errors = 0;

  db.exec('BEGIN');
  try {
    for (const row of rows) {
      const map = {};
      for (const key of Object.keys(row)) {
        map[normalizeKey(key)] = row[key];
      }
      const ig = map['ig'] ?? map['numero ig'] ?? map['n ig'] ?? map['identifiant geographique'] ?? null;
      const adresse = map['adresse'] ?? map['address'] ?? null;
      const numeroBatiment = map['numero batiment'] ?? map['num batiment'] ?? map['n batiment']
        ?? map['numero de batiment'] ?? map['batiment'] ?? null;
      const secteurNom = map['secteur'] ?? map['nom secteur'] ?? map['nom du secteur'] ?? null;
      const secteurNumero = map['numero secteur'] ?? map['num secteur'] ?? map['n secteur']
        ?? map['numero du secteur'] ?? null;
      const x = map['x'] != null ? parseFloat(map['x']) : null;
      const y = map['y'] != null ? parseFloat(map['y']) : null;

      if (x == null || y == null || Number.isNaN(x) || Number.isNaN(y)) {
        errors++;
        continue;
      }

      const { lat, lng } = lambertToWGS84(x, y);
      insert.run(
        ig ? String(ig) : null,
        adresse ? String(adresse) : null,
        numeroBatiment != null ? String(numeroBatiment) : null,
        secteurNom != null ? String(secteurNom) : null,
        secteurNumero != null ? String(secteurNumero) : null,
        x, y, lat, lng
      );
      imported++;
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    return res.status(500).json({ error: 'Erreur pendant l\'import: ' + e.message });
  }

  res.json({ imported, errors, total: rows.length });
});

// ---- Import SHP (points) — accepte un .zip contenant .shp + .dbf (+ .prj optionnel) ----
// Les coordonnées du shapefile sont supposées déjà en WGS84 (lat/lng). Si votre
// shapefile est en Lambert, convertissez-le au préalable ou adaptez ce bloc.
router.post('/import-shp', requireAuth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu' });

  let AdmZip, shapefile;
  try {
    AdmZip = require('adm-zip');
    shapefile = require('shapefile');
  } catch (e) {
    return res.status(500).json({
      error: 'Dépendances manquantes pour l\'import SHP. Exécutez : npm install shapefile adm-zip',
    });
  }

  try {
    const zip = new AdmZip(req.file.buffer);
    const entries = zip.getEntries();
    const shpEntry = entries.find((e) => e.entryName.toLowerCase().endsWith('.shp'));
    const dbfEntry = entries.find((e) => e.entryName.toLowerCase().endsWith('.dbf'));
    if (!shpEntry) return res.status(400).json({ error: 'Le zip ne contient pas de fichier .shp' });

    const shpBuffer = shpEntry.getData();
    const dbfBuffer = dbfEntry ? dbfEntry.getData() : undefined;

    const source = await shapefile.open(shpBuffer, dbfBuffer);
    const insert = db.prepare(`
      INSERT INTO points (ig, adresse, numero_batiment, secteur_nom, secteur_numero, x, y, lat, lng)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let imported = 0;
    let errors = 0;
    let total = 0;

    db.exec('BEGIN');
    try {
      let result = await source.read();
      while (!result.done) {
        total++;
        const feature = result.value;
        const coords = feature.geometry && feature.geometry.coordinates;
        if (!coords) {
          errors++;
          result = await source.read();
          continue;
        }
        const [lng, lat] = coords;
        const props = feature.properties || {};
        const map = {};
        for (const key of Object.keys(props)) map[normalizeKey(key)] = props[key];

        const ig = map['ig'] ?? map['numero ig'] ?? map['n ig'] ?? null;
        const adresse = map['adresse'] ?? map['address'] ?? null;
        const numeroBatiment = map['numero batiment'] ?? map['batiment'] ?? map['n batiment'] ?? null;
        const secteurNom = map['secteur'] ?? map['nom secteur'] ?? null;
        const secteurNumero = map['numero secteur'] ?? map['num secteur'] ?? map['n secteur'] ?? null;
        const conv = wgs84ToLambert(lat, lng);

        insert.run(
          ig ? String(ig) : null,
          adresse ? String(adresse) : null,
          numeroBatiment != null ? String(numeroBatiment) : null,
          secteurNom != null ? String(secteurNom) : null,
          secteurNumero != null ? String(secteurNumero) : null,
          conv.x, conv.y, lat, lng
        );
        imported++;
        result = await source.read();
      }
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      return res.status(500).json({ error: 'Erreur pendant l\'import SHP: ' + e.message });
    }

    res.json({ imported, errors, total });
  } catch (e) {
    res.status(400).json({ error: 'Fichier SHP illisible: ' + e.message });
  }
});

// ---- Import KML (points) ----
router.post('/import-kml', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu' });

  const xml = req.file.buffer.toString('utf8');
  const placemarkRegex = /<Placemark[\s\S]*?<\/Placemark>/g;
  const placemarks = xml.match(placemarkRegex) || [];

  if (placemarks.length === 0) {
    return res.status(400).json({ error: 'Aucun point (Placemark) trouvé dans le fichier KML' });
  }

  const insert = db.prepare(`
    INSERT INTO points (ig, adresse, numero_batiment, secteur_nom, secteur_numero, x, y, lat, lng)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let imported = 0;
  let errors = 0;

  db.exec('BEGIN');
  try {
    for (const pm of placemarks) {
      const coordMatch = pm.match(/<coordinates>([\s\S]*?)<\/coordinates>/);
      if (!coordMatch) { errors++; continue; }
      const [lngStr, latStr] = coordMatch[1].trim().split(',');
      const lng = parseFloat(lngStr);
      const lat = parseFloat(latStr);
      if (Number.isNaN(lat) || Number.isNaN(lng)) { errors++; continue; }

      const nameMatch = pm.match(/<name>([\s\S]*?)<\/name>/);
      const ig = nameMatch ? nameMatch[1].trim() : null;

      // Champs additionnels via <ExtendedData><Data name="..."><value>...</value></Data>
      const dataFields = {};
      const dataRegex = /<Data name="([^"]+)">\s*<value>([\s\S]*?)<\/value>/g;
      let m;
      while ((m = dataRegex.exec(pm)) !== null) {
        dataFields[normalizeKey(m[1])] = m[2].trim();
      }

      const adresse = dataFields['adresse'] ?? dataFields['address'] ?? null;
      const numeroBatiment = dataFields['numero batiment'] ?? dataFields['batiment'] ?? null;
      const secteurNom = dataFields['secteur'] ?? dataFields['nom secteur'] ?? null;
      const secteurNumero = dataFields['numero secteur'] ?? dataFields['num secteur'] ?? null;

      const conv = wgs84ToLambert(lat, lng);
      insert.run(
        ig || null,
        adresse,
        numeroBatiment,
        secteurNom,
        secteurNumero,
        conv.x, conv.y, lat, lng
      );
      imported++;
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    return res.status(500).json({ error: 'Erreur pendant l\'import KML: ' + e.message });
  }

  res.json({ imported, errors, total: placemarks.length });
});

module.exports = router;
