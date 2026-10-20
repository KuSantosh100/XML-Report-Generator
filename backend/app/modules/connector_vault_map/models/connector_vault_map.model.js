const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const VaultMapSchema = new Schema(
  {
    execution_vault: { type: String, default: "" },
    org_code: { type: Schema.Types.ObjectId, ref: "organisation", default: null },
    project_type: { type: String, default: "" },
    vault_id: { type: Schema.Types.ObjectId, ref: 'vault', default: null }
  },
  { timestamps: true, versionKey: false, strict: false }
);

// create the model for users and expose it to our app
module.exports = mongoose.model("connector_vault_map", VaultMapSchema);
