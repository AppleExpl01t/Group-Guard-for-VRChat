const { VRChat } = require('vrchat');

try {
    // Pass minimal options to satisfy constructor
    const client = new VRChat({});
    console.log('Checking VRChat Client methods...');
    
    // Check direct methods on client
    const props = Object.getOwnPropertyNames(Object.getPrototypeOf(client));
    const kickMethods = props.filter(p => p.toLowerCase().includes('kick'));
    const banMethods = props.filter(p => p.toLowerCase().includes('ban'));
    
    console.log('Kick methods found (on Client):', kickMethods);
    console.log('Ban methods found (on Client):', banMethods);

    // Check if there's a groups property (some SDKs wrap it)
    if (client.groups) {
         const groupProps = Object.getOwnPropertyNames(Object.getPrototypeOf(client.groups));
         console.log('Groups API methods:', groupProps.filter(p => p.toLowerCase().includes('kick')));
         console.log('Groups API ban methods:', groupProps.filter(p => p.toLowerCase().includes('ban')));
    }

} catch (e) {
    console.error(e);
}
