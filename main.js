const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false // Allows require in HTML if needed
        }
    });

    //mainWindow.loadFile('public_view/public_view.html');
    //mainWindow.loadFile('user_html/user_dashboard.html');
    mainWindow.loadFile('admin_html/admin_login.html');

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