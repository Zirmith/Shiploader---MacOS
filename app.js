const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const axios = require('axios');
const fs = require('fs-extra');
const extract = require('extract-zip');
const { URL } = require('url');

function createWindow() {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
    });

    win.loadFile('index.html');
}

// Path for storing mods
const modsDirectory = path.join(app.getPath('appData'), 'com.shipofharkinian.soh', 'mods');
fs.ensureDirSync(modsDirectory);

// Function to download and extract mod from URL
async function downloadAndExtractMod(downloadUrl, modName) {
    try {
        const zipPath = path.join(modsDirectory, `${modName}.zip`);

        console.log(`Downloading ${modName} from ${downloadUrl}...`);
        const response = await axios({
            url: downloadUrl,
            method: 'GET',
            responseType: 'stream',
        });

        // Pipe the download to the zip file
        const writer = fs.createWriteStream(zipPath);
        response.data.pipe(writer);

        // Wait for the download to complete
        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });

        console.log(`Extracting ${modName}...`);
        await extract(zipPath, { dir: path.join(modsDirectory, modName) });

        // Remove the zip file after extraction
        fs.unlinkSync(zipPath);
        console.log(`${modName} downloaded and extracted successfully.`);
    } catch (error) {
        console.error(`Failed to download and extract ${modName}:`, error);
    }
}

// Handle custom protocol for Ship of Harkinian
app.on('open-url', (event, url) => {
    event.preventDefault();

    try {
        if (url.startsWith('shipofharkinian:')) {
            // Parse the custom URL (e.g., shipofharkinian:https://gamebanana.com/mmdl/1290796,Mod,545674)
            const parsedUrl = url.replace('shipofharkinian:', '');
            const [downloadLink, modName, modId] = parsedUrl.split(',');

            if (downloadLink && modName) {
                downloadAndExtractMod(downloadLink, modName);
            } else {
                console.error('Invalid URL format');
            }
        }
    } catch (err) {
        console.error('Error handling custom protocol:', err);
    }
});

// Electron app ready event
app.whenReady().then(() => {
    createWindow();

    app.setAsDefaultProtocolClient('shipofharkinian');

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

// Quit when all windows are closed
app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});

// For macOS handling when app is reopened with a URL
app.on('second-instance', (event, commandLine) => {
    if (commandLine.length > 1) {
        const url = commandLine[commandLine.length - 1];
        if (url.startsWith('shipofharkinian:')) {
            app.emit('open-url', {}, url);
        }
    }
});
