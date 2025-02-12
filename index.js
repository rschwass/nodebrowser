const { app, BrowserWindow, session } = require('electron');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

let mainWindow;
const uuid = uuidv4();
const storageFolder = path.join('/cookies', uuid);

// Set custom userData path to /cookies/{UUID}
app.setPath('userData', storageFolder);
console.log(`Electron storage path set to: ${app.getPath('userData')}`);

// Function to save cookies to a file
const saveCookies = async () => {
  try {
    const cookies = await session.defaultSession.cookies.get({});
    const cookieFile = path.join(storageFolder, 'cookies.json');
    fs.writeFileSync(cookieFile, JSON.stringify(cookies, null, 2));
    console.log(`Saved ${cookies.length} cookies to ${cookieFile}`);
  } catch (error) {
    console.error('Failed to save cookies:', error);
  }
};

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
      preload: path.join(__dirname, 'preload.js'), // Optional preload for further customization
    },
  });

  mainWindow.loadURL(url);

  // Save cookies whenever they change
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
