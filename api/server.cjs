/**
 * Local development server
 * Runs the Express API on port 3001
 * Vite dev server proxies /api requests here
 */
const app = require('./app.cjs');

const PORT = process.env.API_PORT || 3001;

app.listen(PORT, () => {
  console.log(`\n  API server running at http://localhost:${PORT}`);
  console.log(`  Health check: http://localhost:${PORT}/api/health\n`);
});
