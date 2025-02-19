const { app, BrowserWindow, session } = require('electron');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

let mainWindow;
const uuid = uuidv4();
const storageFolder = path.join('/cookies', uuid);

app.setPath('userData', storageFolder);
console.log(`Electron storage path set to: ${app.getPath('userData')}`);

// 🚀 Accept all SSL certificates (self-signed or invalid)
app.commandLine.appendSwitch('ignore-certificate-errors');

// 🚀 Set up proxy if provided
const configureProxy = async () => {
    const proxy = process.env.PROXY;

    if (proxy) {
        let formattedProxy = proxy.includes('http=') ? proxy : `http=${proxy};https=${proxy}`;
        try {
            console.log(`[+] Setting Proxy: ${formattedProxy}`);
            await session.defaultSession.setProxy({
                proxyRules: formattedProxy,
                proxyBypassRules: '<local>',
            });
        } catch (error) {
            console.error('[-] Failed to set proxy:', error);
        }
    } else {
        console.log('[-] No proxy set. Proceeding without proxy.');
    }
};

// 🚀 Debug proxy settings
const debugProxy = () => {
    session.defaultSession.resolveProxy('https://www.google.com').then(proxy => {
        console.log(`[+] Electron using proxy: ${proxy}`);
    });
};

// 🚀 Remove CSP headers at the network level
const interceptAllResponses = () => {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        let headers = details.responseHeaders;

        if ('content-security-policy' in headers) {
            delete headers['content-security-policy'];
        }
        if ('Content-Security-Policy' in headers) {
            delete headers['Content-Security-Policy'];
        }

        if ('x-frame-options' in headers) {
            delete headers['x-frame-options'];
        }
        if ('X-Frame-Options' in headers) {
            delete headers['X-Frame-Options'];
        }

        callback({ responseHeaders: headers });
    });
};

// 🚀 Remove CSP Meta Tags from the DOM
const removeMetaCSP = () => {
    mainWindow.webContents.executeJavaScript(`
        document.querySelectorAll("meta[http-equiv='Content-Security-Policy']").forEach(meta => meta.remove());
    `);
};

// 🚀 Kill Service Workers that might enforce CSP
const killServiceWorkers = () => {
    mainWindow.webContents.executeJavaScript(`
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(registrations => {
                for (let reg of registrations) {
                    reg.unregister();
                }
            });
        }
    `);
};

// 🚀 Disable Trusted Types to allow inline scripts
const disableTrustedTypes = () => {
    mainWindow.webContents.executeJavaScript(`
        window.trustedTypes = { createPolicy: () => ({ createHTML: input => input }) };
    `);
};

app.commandLine.appendSwitch('disable-http2'); // Forces HTTP/1.1 instead of HTTP/2


// 🚀 Start Electron App
app.on('ready', async () => {
    await configureProxy();
    debugProxy();

    const args = process.argv.slice(2);
    const url = args[1] || 'https://google.com';

    console.log(`Loading URL: ${url}`);

    mainWindow = new BrowserWindow({
        fullscreen: false,
        kiosk: false,
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            preload: path.join(__dirname, 'preload.js'),
        },
    });

    // Apply CSP bypass and SSL bypass
    interceptAllResponses();

    mainWindow.loadURL(url);

    mainWindow.webContents.once('did-finish-load', async () => {
        removeMetaCSP();
        killServiceWorkers();
        disableTrustedTypes();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
