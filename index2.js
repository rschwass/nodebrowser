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
      console.log(`Loaded cookie: ${cookie.name} (Domain: ${cookie.domain}, Path: ${cookie.path})`);
    }
    console.log('All cookies loaded.');
  } catch (error) {
    console.error('Failed to load cookies:', error);
  }
};

app.on('ready', async () => {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Invalid arguments. Usage: electron app.js <uuid> <url>');
    app.quit();
    return;
  }

  const uuid = args[0];
  const urlToLoad = args[1];

  // Set userData path to a custom directory based on uuid
  const userDataPath = path.join('/tmp/cookies', uuid);
  app.setPath('userData', userDataPath);
  console.log(`User data path set to: ${userDataPath}`);

  // Load cookies manually from the file
  const cookieFile = path.join(userDataPath, 'cookies.json');
  const customSession = session.defaultSession;
  console.log(`Loading cookies from: ${cookieFile}`);
  await loadCookies(cookieFile, customSession);

  mainWindow = new BrowserWindow({
    webPreferences: {
      contextIsolation: true,
      session: customSession,
      devTools: true,
      nodeIntegration: false,
    },
  });

  console.log(`Navigating to: ${urlToLoad}`);
  mainWindow.loadURL(urlToLoad);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
