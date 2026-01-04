import { VRChat } from 'vrchat';
try {
  const client = new VRChat();
  console.log("getUserGroups signature:");
  console.log(client.getUserGroups.toString());
} catch (e) {
  console.error(e);
}
