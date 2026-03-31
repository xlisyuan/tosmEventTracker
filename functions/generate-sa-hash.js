const bcrypt = require("bcryptjs");

const plain = process.argv[2];
if (!plain) {
  console.error("Usage: node generate-sa-hash.js <plain-password>");
  process.exit(1);
}

const hash = bcrypt.hashSync(plain, 10);
console.log(hash);
