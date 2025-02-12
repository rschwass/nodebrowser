const { app, BrowserWindow, session } = require('electron');
const fs = require('fs');
const path = require('path');

let mainWindow;

// Function to load cookies into the specified session
const loadCookies = async (cookieFile, customSession) => {
  if (!fs.existsSync(cookieFile)) {
    console.log(`Cookie file not found at ${cookieFile}`);
    return;
  }

  try {
    const cookies = JSON.parse(fs.readFileSync(cookieFile));
    for (const cookie of cookies) {
      let retries = 3;

      while (retries > 0) {
        try {
          const cookieDetails = {
            url: `${cookie.secure ? 'https' : 'http'}://${cookie.domain.replace(/^\./, '')}${cookie.path}`,
            name: cookie.name,
            value: cookie.value,
            path: cookie.path || '/',
            secure: cookie.secure || cookie.sameSite === 'None',
            httpOnly: cookie.httpOnly,
            expirationDate: cookie.expirationDate,
            sameSite: cookie.sameSite || 'no_restriction'
          };

          await customSession.cookies.set(cookieDetails);
          console.log(`Loaded cookie: ${cookie.name} (Domain: ${cookie.domain}, Path: ${cookie.path})`);
          break;
        } catch (error) {
          retries--;
          console.error(`Failed to set cookie ${cookie.name}. Retries left: ${retries}. Error: ${error.message}`);
          if (retries === 0) console.warn(`Skipped cookie ${cookie.name} after multiple attempts.`);
        }
      }
    }
    console.log('All cookies loaded.');
  } catch (error) {
    console.error('Failed to load cookies:', error);
  }
};

// Function to load localStorage or sessionStorage
const loadStorage = async (storageFile, storageType, customSession) => {
  if (!fs.existsSync(storageFile)) {
    console.log(`${storageType} file not found at ${storageFile}`);
    return;
  }

  try {
    const storageData = JSON.parse(fs.readFileSync(storageFile));
    const preloadScript = `
      (function() {
        const storage = ${storageType === 'localStorage' ? 'window.localStorage' : 'window.sessionStorage'};
        const data = ${JSON.stringify(storageData)};
        Object.keys(data).forEach(key => storage.setItem(key, data[key]));
        console.log('${storageType} injected');
      })();
    `;

    customSession.webRequest.onBeforeRequest({ urls: ['*://*/*'] }, (details, callback) => {
      callback({ cancel: false });
      mainWindow.webContents.executeJavaScript(preloadScript)
        .then(() => console.log(`${storageType} loaded.`))
        .catch(error => console.error(`Failed to inject ${storageType}:`, error));
    });
  } catch (error) {
    console.error(`Failed to load ${storageType}:`, error);
  }
};

app.on('ready', async () => {
  const customSession = session.fromPartition('temporary-session');

  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Invalid arguments. Usage: electron app.js <uuid> <url>');
    app.quit();
    return;
  }

  const uuid = args[0];
  const urlToLoad = args[1];
  const cookieFile = path.join('/cookies/', `${uuid}-cookies.json`);
  const localStorageFile = path.join('/cookies/', `${uuid}-localStorage.json`);
  const sessionStorageFile = path.join('/cookies/', `${uuid}-sessionStorage.json`);

  console.log(`Loading cookies from: ${cookieFile}`);
  console.log(`Loading localStorage from: ${localStorageFile}`);
  console.log(`Loading sessionStorage from: ${sessionStorageFile}`);

  // Load cookies, localStorage, and sessionStorage before creating the window
  await loadCookies(cookieFile, customSession);
  await loadStorage(localStorageFile, 'localStorage', customSession);
  await loadStorage(sessionStorageFile, 'sessionStorage', customSession);

  mainWindow = new BrowserWindow({
    webPreferences: {
      session: customSession,
      contextIsolation: true,
      devTools: true,
      nodeIntegration: false
    }
  });

  console.log(`Navigating to: ${urlToLoad}`);
  mainWindow.loadURL(urlToLoad);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
