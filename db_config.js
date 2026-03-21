const { app } = require('electron');
const path = require('path');
const { createClient } = require("@libsql/client");
const dotenv = require('dotenv');

// 1. Find the .env file whether we are in VS Code or Installed
// Replace your line 7 with this:
const isPackaged = app ? app.isPackaged : (process.resourcesPath && process.resourcesPath.includes('app.asar') === false);
const envPath = isPackaged 
  ? path.join(process.resourcesPath, '.env') 
  : path.join(__dirname, '.env');

dotenv.config({ path: envPath });

// 2. Create the connection using the variables from .env
const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

module.exports = { db };