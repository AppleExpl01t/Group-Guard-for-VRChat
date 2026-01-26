
const Store = require('electron-store');
const store = new Store({ name: 'automod-rules' });

console.log('Current config:', store.store);
store.set('groups', {});
console.log('Cleared groups config.');
console.log('New config:', store.store);
