// Authentification simple par session pour un admin unique.
// Le mot de passe est défini dans le fichier .env (ADMIN_PASSWORD).

function requireAuth(req, res, next) {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  return res.status(401).json({ error: 'Non autorisé. Veuillez vous connecter.' });
}

module.exports = { requireAuth };
