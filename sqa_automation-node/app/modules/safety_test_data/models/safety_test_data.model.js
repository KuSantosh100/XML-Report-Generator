const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const SafetyTestDataSchema = new Schema({
  rule_set:{ type: String },
  rule_set_id:{ type: String },
  vault_id: { type: Schema.Types.ObjectId, ref: "vault" },
  tag_id: { type: String, default: "" },
  test_case_name:{ type: String, default: "" },
  Rules: { type: Array, default: [] }
},{ timestamps: true, versionKey: false, strict: false });

// create the model for project and expose it to our app
module.exports = mongoose.model('safety_test_data', SafetyTestDataSchema);
