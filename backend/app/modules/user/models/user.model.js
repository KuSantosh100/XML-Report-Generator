var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var bcrypt = require('bcryptjs');
var mongooseAggregatePaginate = require('mongoose-aggregate-paginate');

const deleted = [true, false];
const status = ["Active", "Inactive"];

var UserSchema = new Schema({
  first_name: { type: String, default: '' },
  last_name: { type: String, default: '' },
  full_name : { type : String, default: ''},
  login_name : { type : String, default: ''},
  email: { type: String, default: '' },
  //phone : { type: String, default: ''},
  password: { type: String, default: '' },
  org_code:{ type: Schema.Types.ObjectId, ref: 'organisation'},
  project_code:[{ type: Schema.Types.ObjectId, ref: 'project'}],
  //is_admin:{ type: Boolean, default: false, enum: [true, false] },
  role: { type: Schema.Types.ObjectId, ref: 'Role' },
  notification_preference:{ type: String, default: '' },
  last_login: {type:Date, default:Date.now},
  isDeleted: { type: Boolean, default: false, enum: deleted },
  status: { type: String, default: "Active", enum: status },
  password_updatedAt: {type:Date, default:Date.now},
  security_profile: { type: String, default: "basic" }
  //auth_profile:{ type: Schema.Types.ObjectId, ref: 'auth_profile', default:null }
}, { timestamps: true, versionKey: false });

// generating a hash
UserSchema.methods.generateHash = function (password) {
  return bcrypt.hashSync(password, bcrypt.genSaltSync(8), null);
};

// checking if password is valid
UserSchema.methods.validPassword = function (password, checkPassword) {
  return bcrypt.compareSync(password, checkPassword);
  //bcrypt.compare(jsonData.password, result[0].pass
};

// For pagination
UserSchema.plugin(mongooseAggregatePaginate);

// create the model for users and expose it to our app
module.exports = mongoose.model('User', UserSchema);