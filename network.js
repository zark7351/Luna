const { net } = require('electron');
const { askAI } = require('./core');

// Chromium's network stack honors OS proxy/PAC settings; Node fetch does not.
// Used only in the main process after app.whenReady(). Never expose credentials.
function askWithSystemNetwork(settings, key, history, text) {
  return askAI(settings, key, history, text, (url, options) =>
    net.fetch(url, { ...options, credentials: 'omit' }));
}
module.exports = { askWithSystemNetwork };
