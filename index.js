const { app, BrowserWindow, session } = require('electron');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

let mainWindow;

const os = require('os');
const cookieFile = path.join(os.tmpdir(), `${uuidv4()}-cookies.json`);
//const cookieFile = path.join('/tmp/', 'cookies.json');

// Bypass SSL certificate errors
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  event.preventDefault();
  callback(true);
});

app.on('ready', async () => {
// Check if the PROXY environment variable is set
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

  mainWindow = new BrowserWindow({
    fullscreen: true,
    kiosk: true,
    webPreferences: {
      //session: session.fromPartition('persist:temporary-session'),
      contextIsolation: true,
      //devTools: false,
      nodeIntegration: false
    }
  });

  const args = process.argv.slice(1);  // Skip the first argument (AppImage path)
  const url = args[0] || 'https://google.com';  // Default URL if none provided

  if (!url.startsWith('http')) {
    console.error(`Invalid URL: ${url}`);
    app.quit();
    return;
  }


  mainWindow.loadURL(url);
  //mainWindow.loadURL('https://github.com/login');

  // Function to save cookies to a file
  const saveCookies = async () => {
    try {
      const cookies = await session.defaultSession.cookies.get({});
      if (cookies.length > 0) {
        fs.writeFileSync(cookieFile, JSON.stringify(cookies, null, 2));
        console.log(`Saved ${cookies.length} cookies to ${cookieFile}`);
      } else {
        console.log('No cookies found.');
      }
    } catch (error) {
      console.error('Failed to save cookies:', error);
    }
  };

  // Listen for cookie changes and save cookies each time
  session.defaultSession.cookies.on('changed', (event, cookie, cause, removed) => {
    console.log(`Cookie changed: ${cookie.name} (cause: ${cause}, removed: ${removed})`);
    saveCookies();
  });

  // Save cookies once the page has fully loaded
  mainWindow.webContents.once('did-finish-load', () => {
    console.log('Page loaded. Initial cookie capture...');
    saveCookies();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
