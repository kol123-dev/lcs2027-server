// Central 404 + error handler. Keeps the operation layer thin.
export function notFoundHandler(req, res) {
  res.status(404).json({ error: "Not found", path: req.originalUrl });
}

export function errorHandler(err, req, res, _next) {
  const status = err.status || (err.isCorsError ? 401 : 500);
  if (status >= 500) {
    // eslint-disable-next-line no-console
    console.error(`[${new Date().toISOString()}]`, err.message, err.stack || "");
  }
  res.status(status).json({
    error: err.message || "Internal server error",
    ...(envDebug() ? { stack: err.stack } : {}),
  });
}

function envDebug() {
  return ["development", "test"].includes(process.env.NODE_ENV);
}