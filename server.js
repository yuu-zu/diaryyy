require('dotenv').config();

const https = require('https');
const fs = require('fs');
const path = require('path');
const app = require('./app');
const { ensureNoteSecurityColumns } = require('./models/note');
const { ensureUserProfileColumns } = require('./models/user');

const port = Number(process.env.PORT || 3001);
const certDir = path.join(__dirname, 'cert');
const keyPath = path.join(certDir, 'key.pem');
const certPath = path.join(certDir, 'cert.pem');
const useHttps = String(process.env.USE_HTTPS || 'true').toLowerCase() === 'true'
  && fs.existsSync(keyPath)
  && fs.existsSync(certPath);

const httpsOptions = useHttps
  ? {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath)
    }
  : null;

async function startServer() {
  await ensureUserProfileColumns();
  await ensureNoteSecurityColumns();

  if (useHttps) {
    https.createServer(httpsOptions, app).listen(port, () => {
      console.log(`Secure Notes app running at https://localhost:${port}`);
    });
  } else {
    app.listen(port, () => {
      console.log(`Secure Notes app running at http://localhost:${port}`);
    });
  }
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
