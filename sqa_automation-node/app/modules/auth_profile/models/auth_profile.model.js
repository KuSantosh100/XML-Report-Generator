const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const mongooseAggregatePaginate = require('mongoose-aggregate-paginate');

const AuthProfileSchema = new Schema({
  configuration: { },
  type: { type: String, default: '' },
  org_code:{ type: Schema.Types.ObjectId, ref: 'organisation'},
  logoutUrl:{ type: String, default: '' }
}, { timestamps: true, versionKey: false });

// For pagination
AuthProfileSchema.plugin(mongooseAggregatePaginate);

// create the model for users and expose it to our app
module.exports = mongoose.model('auth_profile', AuthProfileSchema);