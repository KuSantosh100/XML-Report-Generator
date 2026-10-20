const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const mongooseAggregatePaginate = require('mongoose-aggregate-paginate');

const status = ["Active", "Scheduled", "Inactive"];

const ExecutionSchema = new Schema(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    org_code: { type: Schema.Types.ObjectId, ref: 'organisation', default: null },
    status: { type: String, default: 'Active', enum: status },
    isDeleted: { type: Boolean, default: false, enum: [true, false] },
    project_id: { type: Schema.Types.ObjectId, ref: 'project', default: null },
    test_suite_id: { type: Schema.Types.ObjectId, ref: 'test_suite', default: null },
    tag_id: { type: Array, default: [] },
    test_case_id:[{ type: Schema.Types.ObjectId, ref: 'test_case' }],
    location: { type: String, default: '' },
    build_no: { type: Number, default: null },
    que_no: { type: Number, default: '' },
    result_status: { type: String, default: null },
    estimated_duration: { type: String, default: 'N/A' },
    reason: { type: String, default: null },
    schedule_date: { type: Date, default: null },
    vault:  { type: Schema.Types.ObjectId, ref: 'vault', default: null  },
    dry_run: { type: Boolean, default: false, enum: [true, false] },
    end_date: { type: Date, default: null },
    ccInfo: {},
    report_path:{}
  }, { timestamps: true, versionKey: false,  strict: false  });

// For pagination
ExecutionSchema.plugin(mongooseAggregatePaginate);

// create the model for users and expose it to our app
module.exports = mongoose.model('execution', ExecutionSchema);