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
      if (cookie.name.startsWith('__Host-') || cookie.name.startsWith('__Secure-')) {
        console.warn(`Skipping invalid cookie: ${cookie.name}`);
        continue;
      }

      const cookieDetails = {
        url: `https://${cookie.domain.replace(/^\./, '')}${cookie.path}`,
        name: cookie.name,
        value: cookie.value,
        path: cookie.path,
        secure: cookie.secure,
        httpOnly: cookie.httpOnly,
        expirationDate: cookie.expirationDate
      };

      await customSession.cookies.set(cookieDetails);
      console.log(`Loaded cookie: ${cookie.name}`);
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
      await customsSession.setProxy({ proxyRules: proxy });
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
  const urlToLoad = args[1]; // Second argument as the URL

  console.log(`Loading cookies from: ${cookieFile}`);
  console.log(`Navigating to: ${urlToLoad}`);

  await loadCookies(cookieFile, customSession);  // Ensure cookies are loaded before navigating

  mainWindow = new BrowserWindow({
    webPreferences: {
      session: customSession,
      contextIsolation: true,
      devTools: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadURL(urlToLoad);  // Load the specified URL
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
