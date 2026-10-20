const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const mongooseAggregatePaginate = require('mongoose-aggregate-paginate');

const status = ["Active", "Inactive"];

const TestSuiteSchema = new Schema(
  {
    suite_name: { type: String, default: '' },
    org_code: { type: Schema.Types.ObjectId, ref: 'organisation' },
    project_code: { type: Schema.Types.ObjectId, ref: 'project' },
    status: { type: String, default: 'Active', enum: status },
    isDeleted: { type: Boolean, default: false, enum: [true, false] },
    suite_id: { type: String, default: '' }
  },
  { timestamps: true, versionKey: false }

);

// For pagination
TestSuiteSchema.plugin(mongooseAggregatePaginate);

// create the model for users and expose it to our app
module.exports = mongoose.model('test_suite', TestSuiteSchema);