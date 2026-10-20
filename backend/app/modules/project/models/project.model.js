const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const mongooseAggregatePaginate = require("mongoose-aggregate-paginate");

const status = ["Active", "Inactive"];

const projectType = [ 'CRM','CTMS', 'Clinical', 'Clinical Hotfix',
  'LIMS', 'LIMS Hotfix', 'Medical', 'Platform', 'PromoMats', 'PromoMats Hotfix',
  'QMS', 'Quality', 'Quality Hotfix',  'QualityDocs', 'RIM', 'RIM Hotfix', 'RIM Submissions', 'Safety', 'SafetyDocs', 'Training','eTMF' ];

const ProjectSchema = new Schema(
  {
    project_name: { type: String, default: "" },
    org_code: { type: Schema.Types.ObjectId, ref: "organisation" },
    projectIcon: { type: String, default: "" },
    type: { type: String, enum: projectType },
    status: { type: String, default: "Active", enum: status },
    isDeleted: { type: Boolean, default: false, enum: [true, false] },
    sortorder: { type: Number },
    notification_email: { type: String, default: '' },
    supported_vault_release: { type: String, default: '' },
    release_date: { type: Date, default: Date.now}
  },
  { timestamps: true, versionKey: false }
);

// For pagination
ProjectSchema.plugin(mongooseAggregatePaginate);

// create the model for project and expose it to our app
module.exports = mongoose.model("project", ProjectSchema);
