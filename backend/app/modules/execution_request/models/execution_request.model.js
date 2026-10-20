const mongoose = require('mongoose');
const Schema = mongoose.Schema;


const ExecutionReqSchema = new Schema({
  testcase_id: { type: Schema.Types.ObjectId, ref: 'test_case', default: null },
  test_case_id : { type: String, default: null },
  org_code: { type: Schema.Types.ObjectId, ref: 'organisation' },
  execution_vault : { type: String, default: null },
  execution_type: { type: String, default: null },
  test_case_steps: [],
  execution_id : { type: Schema.Types.ObjectId, default: null },
  request_id : { type: String, default: null },
  dryRun_object_id: { type: String, default: null },
  test_suite_name: { type: String, default: null },
  comments: { type: String, default: null },
  source_req_body:{},
  status: {type: String, default: 'OPEN'},
  created_by:{ type: Schema.Types.ObjectId, ref: 'user', default: null },
  failure_reason: { type: String, default: null },
  run_number: { type: String, default: null },
  connector_url: { type: String, default: null }
},
{ timestamps: true, versionKey: false, strict: false });

module.exports = mongoose.model('execution_request', ExecutionReqSchema);