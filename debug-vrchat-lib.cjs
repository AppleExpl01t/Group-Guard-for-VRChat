const { VRChat } = require('vrchat');
// It might be a class or a function that returns a client
// AuthService.ts uses const { VRChat } = require('vrchat'); then const client = new VRChat(options);
const client = new VRChat();
console.log(client.getUserGroups.toString());
