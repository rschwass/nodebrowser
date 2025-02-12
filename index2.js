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
    console.log(`Found ${cookies.length} cookies to load.`);

    for (const cookie of cookies) {
      const cookieDetails = {
        url: `${cookie.secure ? 'https' : 'http'}://${cookie.domain.replace(/^\./, '')}${cookie.path}`,
        name: cookie.name,
        value: cookie.value,
        path: cookie.path,
        secure: cookie.secure,
        httpOnly: cookie.httpOnly,
        expirationDate: cookie.expirationDate
      };

      try {
        await customSession.cookies.set(cookieDetails);
        console.log(`Loaded cookie: ${cookie.name}`);
      } catch (error) {
        console.error(`Failed to set cookie ${cookie.name}:`, error);
      }
    }

    console.log('All cookies loaded.');
  } catch (error) {
    console.error('Failed to load cookies:', error);
  }
};

app.on('ready', async () => {
  const customSession = session.fromPartition('temporary-session');
  const proxy = process.env.PROXY;

  if (proxy) {
    try {
      await customSession.setProxy({ proxyRules: proxy });
      console.log(`Proxy set to: ${proxy}`);
    } catch (error) {
      console.error('Failed to set proxy:', error);
    }
  } else {
    console.log('No proxy set. Proceeding without proxy.');
  }

  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Invalid arguments. Usage: electron app.js <path-to-cookie-file> <url>');
    app.quit();
    return;
  }

  const cookieFile = path.resolve(args[0]);
  const urlToLoad = args[1];

  console.log(`Loading cookies from: ${cookieFile}`);
  console.log(`Navigating to: ${urlToLoad}`);

  await loadCookies(cookieFile, customSession);

  mainWindow = new BrowserWindow({
    webPreferences: {
      session: customSession,
      contextIsolation: true,
      devTools: true,
      nodeIntegration: false
    }
  });

  // Ensure all cookies are loaded before navigating to the URL
  mainWindow.webContents.once('did-finish-load', async () => {
    const loadedCookies = await customSession.cookies.get({});
    console.log(`Currently loaded cookies (${loadedCookies.length}):`, loadedCookies);
  });

  mainWindow.loadURL(urlToLoad);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
