const crypto = require('crypto');
const fs = require('fs');
let key = '';
const path = 'buffer.txt'
module.exports = function() {
  try {
    if (!fs.existsSync(path)) {
      //file exists
      key = crypto.randomBytes(32);
      fs.writeFileSync(path, key, { mode: 0o755 });
    }
    else{
      key = fs.readFileSync(path);
    }
    return key;
  } catch(err) {
    console.error(err)
  }
}