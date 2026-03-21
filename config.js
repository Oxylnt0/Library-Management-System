const { app } = require('electron');
const path = require('path');
const dotenv = require('dotenv');

// Check if we are running in VS Code or as a packaged .exe
const isPackaged = app ? app.isPackaged : process.env.NODE_ENV === 'production';

// Define the path to the .env file
const envPath = isPackaged 
  ? path.join(process.resourcesPath, '.env') // Look in the 'resources' folder of the installed app
  : path.join(__dirname, '.env');           // Look in the root folder while coding

// Load the variables
dotenv.config({ path: envPath });

module.exports = {
  envPath,
  isPackaged
};