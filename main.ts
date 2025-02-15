const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
    });

    // Debug loading
    win.webContents.on('did-fail-load', ( errorCode: any, errorDescription: any) => {
        console.error('Failed to load:', errorCode, errorDescription);
    });

    // In development mode
    if (process.env.VITE_DEV_SERVER_URL) {
        console.log('Loading from dev server...');
        win.loadURL('http://localhost:5173');
    } else {
        // In production mode
        try {
            const indexPath = path.join(__dirname, './dist/index.html');
            console.log('Loading from:', indexPath);
            win.loadFile(indexPath).catch((error: any) => {
                console.error('Error loading index.html:', error);
                app.quit();
            });
        } catch (error) {
            console.error('Error loading index.html:', error);
            app.quit();
        }
    }
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