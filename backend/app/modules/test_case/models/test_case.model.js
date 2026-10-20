const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const mongooseAggregatePaginate = require('mongoose-aggregate-paginate');

const status = ["Active", "Inactive"];

const TestCaseSchema = new Schema({
  test_case_name: { type: String, default: '' },
  test_suite_code: { type: Schema.Types.ObjectId, ref: 'test_suite', default: null },
  release_no: { type: String, default: '1.0' },
  release_date: { type: Date, default: Date.now },
  requirement_no: { type: String, default: '' },
  description: { type: String, default: '' },
  status: { type: String, default: 'Active', enum: status },
  isDeleted: { type: Boolean, default: false, enum: [true, false] },
  tag_id: { type: String, default: '' },
  test_case_id: { type: String, default: '' },
  test_step_start_no:  { type: Number, default: 0 },
  test_case_series: { type: String, default: '' },
  last_execution:{ type: Array },
  Approver: { type: String, default: null },
  QualityApprover: { type: String, default: null },
  vassureReferenceNo: { type: String, default: null },
  org_code: { type: Schema.Types.ObjectId, ref: 'organisation' },
  source_object_name:{ type: String, default: null },
  test_steps:{ type: Array, default: null },
  comments:{ type: String, default: null },
  created_by:{ type: Schema.Types.ObjectId, ref: 'user', default: null },
  os:{ type: String, default: "linux" }
},
  { timestamps: true, versionKey: false }
);

// For pagination
TestCaseSchema.plugin(mongooseAggregatePaginate);

// create the model for users and expose it to our app
module.exports = mongoose.model('test_case', TestCaseSchema);