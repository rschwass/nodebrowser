const { ipcRenderer } = require('electron');

window.addEventListener('DOMContentLoaded', () => {
  const sendStorageData = () => {
    const localStorageData = {};
    const sessionStorageData = {};

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      localStorageData[key] = localStorage.getItem(key);
    }

    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      sessionStorageData[key] = sessionStorage.getItem(key);
    }

    ipcRenderer.send('storage-updated', JSON.stringify(localStorageData), JSON.stringify(sessionStorageData));
  };

  // Monitor storage changes using a MutationObserver on the DOM
  const monitorStorageChanges = () => {
    const originalSetItem = Storage.prototype.setItem;
    const originalRemoveItem = Storage.prototype.removeItem;

    Storage.prototype.setItem = function (key, value) {
      originalSetItem.apply(this, arguments);
      sendStorageData();
    };

    Storage.prototype.removeItem = function (key) {
      originalRemoveItem.apply(this, arguments);
      sendStorageData();
    };
  };

  monitorStorageChanges();
  sendStorageData(); // Initial capture of storage data
});
