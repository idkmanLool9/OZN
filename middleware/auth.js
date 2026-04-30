function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    res.locals.user = {
      id: req.session.userId,
      username: req.session.username,
      fullName: req.session.fullName,
      role: req.session.role,
    };
    return next();
  }
  return res.redirect('/login');
}

function redirectIfAuth(req, res, next) {
  if (req.session && req.session.userId) return res.redirect('/');
  next();
}

module.exports = { requireAuth, redirectIfAuth };
