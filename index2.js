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
            secure: cookie.secure || cookie.sameSite === 'None', // Enforce secure if SameSite=None
            httpOnly: cookie.httpOnly,
            expirationDate: cookie.expirationDate,
            sameSite: cookie.sameSite || 'no_restriction' // Allow SameSite=None cookies
          };

          await customSession.cookies.set(cookieDetails);
          console.log(`Loaded cookie: ${cookie.name} (Domain: ${cookie.domain}, Path: ${cookie.path})`);
          break; // Exit retry loop if successful
        } catch (error) {
          retries--;
          console.error(`Failed to set cookie ${cookie.name}. Retries left: ${retries}. Error: ${error.message}`);
          if (retries === 0) {
            console.warn(`Skipped cookie ${cookie.name} after multiple attempts.`);
          }
        }
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

  await loadCookies(cookieFile, customSession); // Ensure cookies are loaded before navigating

  mainWindow = new BrowserWindow({
    webPreferences: {
      session: customSession,
      contextIsolation: true,
      devTools: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadURL(urlToLoad);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
