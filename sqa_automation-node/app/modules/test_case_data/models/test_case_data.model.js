const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const TestDataSchema = new Schema({
  project_type: {type: String, default: ''},
  org_code:{ type: Schema.Types.ObjectId, ref: 'organisation'},
  cust_keys:{ type: Array, default: [] }
},{ strict: false });

// create the model for project and expose it to our app
module.exports = mongoose.model('test_case_data', TestDataSchema);
