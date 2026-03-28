export function notFoundHandler(req, res) {
  res.status(404).json({ ok: false, error: 'not_found' });
}

export function errorHandler(err, req, res, next) {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(500).json({ ok: false, error: 'internal_error' });
}
