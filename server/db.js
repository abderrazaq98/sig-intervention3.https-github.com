const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DB_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const DB_PATH = path.join(DB_DIR, 'points.db');
const db = new DatabaseSync(DB_PATH);

// Création de la table si elle n'existe pas
db.exec(`
  CREATE TABLE IF NOT EXISTS points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ig TEXT,
    adresse TEXT,
    x REAL,
    y REAL,
    lat REAL,
    lng REAL,
    commentaire TEXT,
    date_creation TEXT DEFAULT CURRENT_TIMESTAMP,
    date_modification TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

// Index pour accélérer la recherche sur de gros volumes (1000+ points)
db.exec(`CREATE INDEX IF NOT EXISTS idx_points_ig ON points(ig);`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_points_adresse ON points(adresse);`);

// ---- Migrations légères : ajout de colonnes si elles n'existent pas encore ----
// (numéro de bâtiment + secteur). On vérifie via PRAGMA table_info avant d'altérer
// la table pour éviter une erreur "duplicate column name" au redémarrage.
const existingColumns = db.prepare('PRAGMA table_info(points)').all().map((c) => c.name);

const columnsToAdd = [
  { name: 'numero_batiment', type: 'TEXT' },
  { name: 'secteur_nom', type: 'TEXT' },
  { name: 'secteur_numero', type: 'TEXT' },
];

for (const col of columnsToAdd) {
  if (!existingColumns.includes(col.name)) {
    db.exec(`ALTER TABLE points ADD COLUMN ${col.name} ${col.type};`);
  }
}

db.exec(`CREATE INDEX IF NOT EXISTS idx_points_batiment ON points(numero_batiment);`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_points_secteur ON points(secteur_numero);`);

module.exports = db;
