const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const mongooseAggregatePaginate = require('mongoose-aggregate-paginate');

const OrganisationSchema = new Schema({
  org_name: { type: String, default: '' },
  country: { type: String, default: '' },
  isDeleted: { type: Boolean, default: false, enum: [true, false] },
  api_frequency: { type: Number, default: '5' }, 
  enabledFn:{type: Array, default: [] }
}, { timestamps: true, versionKey: false });

// For pagination
OrganisationSchema.plugin(mongooseAggregatePaginate);

// create the model for users and expose it to our app
module.exports = mongoose.model('organisation', OrganisationSchema);