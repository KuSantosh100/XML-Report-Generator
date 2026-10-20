const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const mongooseAggregatePaginate = require('mongoose-aggregate-paginate');

const ProjectSettingSchema = new Schema({
  project_code:{ type: Schema.Types.ObjectId, ref: 'project', default:null },
  setting_name: { type: String, default: '' },
  setting_value: { type: String, default: '' },
  updated_by:{type: Schema.Types.ObjectId, ref: 'User', default:null},
  isDeleted: { type: Boolean, default: false, enum: [true, false] }
}, { timestamps: true, versionKey: false });

// For pagination
ProjectSettingSchema.plugin(mongooseAggregatePaginate);

// create the model for users and expose it to our app
module.exports = mongoose.model('project_setting', ProjectSettingSchema);