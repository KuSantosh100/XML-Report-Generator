const userModel = require("./app/modules/user/models/user.model.js");
const User = new userModel();

if (process.argv.length === 2) {
    console.error('Password argument is missing!');
    process.exit(1);
}
let pwd = process.argv[2];

let encryptedPassword = User.generateHash(pwd);
console.log(encryptedPassword);
