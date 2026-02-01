
const reJoining = /(?:Joining|Entering|Destination set:?)\s+(wrld_[a-zA-Z0-9-]+):([^\s]+)/;

const testLines = [
  // Standard format
  "[Behaviour] Joining wrld_4cf554b4-430c-4f8f-b53e-1f294e230448:88888~group(grp_74720616-430c-4f8f-b53e-1f294e230448)",
  // New Destination Set format
  "[Behaviour] Destination set: wrld_4cf554b4-430c-4f8f-b53e-1f294e230448:88888~group(grp_74720616-430c-4f8f-b53e-1f294e230448)",
  // Destination set without colon (robustness)
  "[Behaviour] Destination set wrld_123:instance",
];

console.log("--- Testing Improved Regex ---");

testLines.forEach((line, index) => {
  console.log(`\n[${index}] Testing: ${line.substring(0, 80)}...`);
  const match = line.match(reJoining);
  
  if (match) {
    console.log(`✅ MATCH: World=${match[1]} | Instance=${match[2]}`);
  } else {
    console.log("❌ NO MATCH");
  }
});
