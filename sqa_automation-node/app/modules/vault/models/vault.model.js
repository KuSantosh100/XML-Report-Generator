const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const mongooseAggregatePaginate = require("mongoose-aggregate-paginate");

const VaultSchema = new Schema(
  {
    project_code: {
    type: Schema.Types.ObjectId, ref: "project", default: null },
    vault_name: { type: String, default: "" },
    org_code: { type: Schema.Types.ObjectId, ref: "organisation", default: null },
    project_type: { type: String, default: "" },
    jenkins_base_url:  { type: String, default: "" },
    jenkins_job_name:  { type: String, default: "" },
    updated_by: { type: Schema.Types.ObjectId, ref: "User", default: null },
    isDeleted: { type: Boolean, default: false, enum: [true, false] },
    display_name:{ type: String, default: "" },
    product_version: { type: String, default: "" }
  },
  { timestamps: true, versionKey: false, strict: false }
);

// For pagination
VaultSchema.plugin(mongooseAggregatePaginate);

// create the model for users and expose it to our app
module.exports = mongoose.model("vault", VaultSchema);
