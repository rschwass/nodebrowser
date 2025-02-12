const { ipcRenderer } = require('electron');

const notifyStorageChange = () => {
  const localStorageData = JSON.stringify(localStorage);
  const sessionStorageData = JSON.stringify(sessionStorage);

  ipcRenderer.send('storage-updated', localStorageData, sessionStorageData);
};

const monitorStorage = () => {
  const originalSetItem = Storage.prototype.setItem;
  const originalRemoveItem = Storage.prototype.removeItem;

  Storage.prototype.setItem = function (key, value) {
    originalSetItem.apply(this, arguments);
    notifyStorageChange();
  };

  Storage.prototype.removeItem = function (key) {
    originalRemoveItem.apply(this, arguments);
    notifyStorageChange();
  };

  window.addEventListener('storage', notifyStorageChange);
};

monitorStorage();
