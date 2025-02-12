const { app, BrowserWindow, session } = require('electron');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

let mainWindow;
const storageFolder = path.join('/cookies/');

// Generate a single UUID for this session
const uuid = uuidv4();
const storageFile = (type) => path.join(storageFolder, `${uuid}-${type}.json`); // uuid-cookies.json, uuid-localStorage.json, uuid-sessionStorage.json

// Bypass SSL certificate errors
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  event.preventDefault();
  callback(true);
});

app.on('ready', async () => {
  const proxy = process.env.PROXY;

  if (proxy) {
    try {
      await session.defaultSession.setProxy({ proxyRules: proxy });
      console.log(`Proxy set to: ${proxy}`);
    } catch (error) {
      console.error('Failed to set proxy:', error);
    }
  } else {
    console.log('No proxy set. Proceeding without proxy.');
  }

  const args = process.argv.slice(2);
  const url = args[1] || 'https://google.com'; // Default to Google if no URL provided

  if (!url.startsWith('http')) {
    console.error(`Invalid URL: ${url}`);
    app.quit();
    return;
  }

  console.log(`Loading URL: ${url}`);

  mainWindow = new BrowserWindow({
    fullscreen: true,
    kiosk: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js') // Preload script for injecting storage listener
    }
  });

  mainWindow.loadURL(url);

  // Function to save cookies
  const saveCookies = async () => {
    try {
      const cookies = await session.defaultSession.cookies.get({});
      const cookieFile = storageFile('cookies');
      fs.writeFileSync(cookieFile, JSON.stringify(cookies, null, 2));
      console.log(`Saved ${cookies.length} cookies to ${cookieFile}`);
    } catch (error) {
      console.error('Failed to save cookies:', error);
    }
  };

  // Function to save localStorage and sessionStorage
  const saveStorage = async (localStorageData, sessionStorageData) => {
    try {
      // Save localStorage
      const localFile = storageFile('localStorage');
      fs.writeFileSync(localFile, localStorageData);
      console.log(`Saved localStorage to ${localFile}`);

      // Save sessionStorage
      const sessionFile = storageFile('sessionStorage');
      fs.writeFileSync(sessionFile, sessionStorageData);
      console.log(`Saved sessionStorage to ${sessionFile}`);
    } catch (error) {
      console.error('Failed to save storage data:', error);
    }
  };

  // Handle storage updates from the renderer process
  const { ipcMain } = require('electron');
  ipcMain.on('storage-updated', (event, localStorageData, sessionStorageData) => {
    console.log('Storage change detected. Saving storage...');
    saveStorage(localStorageData, sessionStorageData);
  });

  // Save cookies when they change
  session.defaultSession.cookies.on('changed', async () => {
    console.log('Cookie change detected. Saving cookies...');
    await saveCookies();
  });

  mainWindow.webContents.once('did-finish-load', async () => {
    console.log('Page loaded. Initial data capture...');
    await saveCookies();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
