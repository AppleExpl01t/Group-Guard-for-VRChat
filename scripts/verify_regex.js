
const reJoining = /(?:Joining|Entering)\s+(wrld_[a-zA-Z0-9-]+):([^\s]+)/;

const testLines = [
  // Standard format
  "[2024.10.05 20:38:22] [Behaviour] Joining wrld_4cf554b4-430c-4f8f-b53e-1f294e230448:88888~group(grp_74720616-430c-4f8f-b53e-1f294e230448)",
  // Entering format
  "[2024.10.05 20:38:22] [Behaviour] Entering wrld_4cf554b4-430c-4f8f-b53e-1f294e230448:88888~group(grp_74720616-430c-4f8f-b53e-1f294e230448)",
  // Underscores in Group ID (Hypothetical but possible)
  "[2024.10.05 20:38:22] [Behaviour] Joining wrld_123:12345~group(grp_my_cool_group_1)",
  "Joining wrld_TEST:123",
];

console.log("--- Testing Regex 2 ---");

testLines.forEach((line, index) => {
  console.log(`\n[${index}] Testing: ${line.substring(0, 50)}...`);
  const match = line.match(reJoining);
  
  if (match) {
    console.log(`   MATCH: World=${match[1]}`);
    console.log(`   FULL INSTANCE STRING: ${match[2]}`);
    
    // Group Extraction
    const fullLoc = `${match[1]}:${match[2]}`;
    const groupMatch = fullLoc.match(/~group\((grp_[a-zA-Z0-9_-]+)\)/i);
    
    if (groupMatch) {
       console.log(`   GROUP: ${groupMatch[1]}`);
    } else {
       console.log(`   NO GROUP`);
    }

  } else {
    console.log("   NO MATCH");
  }
});
