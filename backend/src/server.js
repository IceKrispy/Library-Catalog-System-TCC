const app = require('./app');

const PORT = process.env.PORT || 5000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`✓ Server running on http://localhost:${PORT}`);
    console.log(`✓ API available at http://localhost:${PORT}/api/v1`);
    console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

module.exports = app;
