const { app, BrowserWindow } = require('electron');
const path = require('path');

// Start the Backend Express Server automatically
require('./server.js');

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        icon: path.join(__dirname, 'assets', 'library_logo.jpg'),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false // Allows require in HTML if needed
        }
    });

    mainWindow.maximize();
    mainWindow.show();

    
    //mainWindow.loadFile('public_view/public_view.html');
    mainWindow.loadFile('admin_html/admin_login.html');
    //mainWindow.loadFile('admin_html/admin_dashboard.html');
}

app.whenReady().then(() => {
    
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});