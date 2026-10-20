const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const TestCaseHistSchema = new Schema({
  testcase_id: { type: Schema.Types.ObjectId, ref: 'test_case' },
  data: {},
  request_id: { type: String, default: '' },
  comments: { type: String, default: '' }
},
  { timestamps: true, versionKey: false }
);


// create the model for users and expose it to our app
module.exports = mongoose.model('test_case_hist', TestCaseHistSchema);