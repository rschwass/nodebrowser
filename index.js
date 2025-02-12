const { app, BrowserWindow, session } = require('electron');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const os = require('os');

let mainWindow;
const storageFolder = path.join('/cookies/');
const storageFile = (type) => path.join(storageFolder, `${uuidv4()}-${type}.json`);

// Ensure the storage folder exists
if (!fs.existsSync(storageFolder)) {
  fs.mkdirSync(storageFolder, { recursive: true });
}

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
  const url = args[1] || 'https://google.com';

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
    },
  });

  mainWindow.loadURL(url);

  // Function to save cookies
  const saveCookies = async () => {
    try {
      const cookies = await session.defaultSession.cookies.get({});
      if (cookies.length > 0) {
        const cookieFile = storageFile('cookies');
        fs.writeFileSync(cookieFile, JSON.stringify(cookies, null, 2));
        console.log(`Saved ${cookies.length} cookies to ${cookieFile}`);
      } else {
        console.log('No cookies found.');
      }
    } catch (error) {
      console.error('Failed to save cookies:', error);
    }
  };

  // Function to save localStorage and sessionStorage
  const saveStorage = async () => {
    try {
      const storageData = await mainWindow.webContents.executeJavaScript(`
        (function() {
          return {
            localStorage: JSON.stringify(localStorage),
            sessionStorage: JSON.stringify(sessionStorage)
          };
        })();
      `);

      // Save localStorage
      const localFile = storageFile('localStorage');
      fs.writeFileSync(localFile, storageData.localStorage);
      console.log(`Saved localStorage to ${localFile}`);

      // Save sessionStorage
      const sessionFile = storageFile('sessionStorage');
      fs.writeFileSync(sessionFile, storageData.sessionStorage);
      console.log(`Saved sessionStorage to ${sessionFile}`);
    } catch (error) {
      console.error('Failed to save storage data:', error);
    }
  };

  // Save cookies, localStorage, and sessionStorage after the page loads
  mainWindow.webContents.once('did-finish-load', async () => {
    console.log('Page loaded. Capturing data...');
    await saveCookies();
    await saveStorage();
  });

  session.defaultSession.cookies.on('changed', async (event, cookie, cause, removed) => {
    console.log(`Cookie changed: ${cookie.name} (cause: ${cause}, removed: ${removed})`);
    await saveCookies();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
