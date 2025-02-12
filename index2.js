const { app, BrowserWindow, session } = require('electron');
const fs = require('fs');
const path = require('path');

let mainWindow;

const loadCookies = async (cookieFile, customSession) => {
  if (!fs.existsSync(cookieFile)) {
    console.log(`Cookie file not found at ${cookieFile}`);
    return;
  }

  try {
    const cookies = JSON.parse(fs.readFileSync(cookieFile));
    for (const cookie of cookies) {
      const cookieDetails = {
        url: `${cookie.secure ? 'https' : 'http'}://${cookie.domain.replace(/^\./, '')}${cookie.path}`,
        name: cookie.name,
        value: cookie.value,
        path: cookie.path || '/',
        secure: cookie.secure || cookie.sameSite === 'None',
        httpOnly: cookie.httpOnly,
        expirationDate: cookie.expirationDate,
        sameSite: cookie.sameSite || 'no_restriction',
      };
      await customSession.cookies.set(cookieDetails);
    }
    console.log('All cookies loaded.');
  } catch (error) {
    console.error('Failed to load cookies:', error);
  }
};

const loadStorage = async (storageFile, storageType) => {
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
    return preloadScript;
  } catch (error) {
    console.error(`Failed to load ${storageType}:`, error);
    return '';
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

  // Load cookies and storage before creating the window
  await loadCookies(cookieFile, customSession);

  const localStorageScript = await loadStorage(localStorageFile, 'localStorage');
  const sessionStorageScript = await loadStorage(sessionStorageFile, 'sessionStorage');

  mainWindow = new BrowserWindow({
    webPreferences: {
      session: customSession,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      devTools: true,
      nodeIntegration: false,
    },
  });

  mainWindow.webContents.session.webRequest.onBeforeRequest({ urls: ['*://*/*'] }, async (details, callback) => {
    if (details.url === urlToLoad) {
      console.log('Injecting storage data...');
      await mainWindow.webContents.executeJavaScript(localStorageScript);
      await mainWindow.webContents.executeJavaScript(sessionStorageScript);
      console.log('Storage data injected. Proceeding with navigation.');
    }
    callback({ cancel: false });
  });

  console.log(`Navigating to: ${urlToLoad}`);
  mainWindow.loadURL(urlToLoad);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
