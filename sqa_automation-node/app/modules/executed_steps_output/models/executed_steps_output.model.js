const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ExecutionStepsOutputSchema = new Schema({
    execution_id: { type: Schema.Types.ObjectId, default: null  },
    step_no: { type: Number, default: null },
    tag_id: { type: String, default: '' },
    test_case_id: { type: String, default: '' },
    build_no: { type: Number, default: null },
    type: { type: String, default: '' },
    executed_time: { type: Object, default: '' },
    procedure: { type: Array, default: [] },
    expected_result: { type: String, default: '' },
    actual_result: { type: String, default: '' },
    status: { type: String, default: '' },
    screenshots: { type: Array, default: [] }
 //   s3_path: { type: Array, default: [] }
},
{ timestamps: true, versionKey: false, strict: false });

module.exports = mongoose.model('executed_steps_output', ExecutionStepsOutputSchema);