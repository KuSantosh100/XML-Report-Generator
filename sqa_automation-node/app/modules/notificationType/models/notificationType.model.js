const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const NotificationTypeSchema = new Schema(
  {
   label: { type: String },
   color: { type: String }
  },
  { timestamps: true, versionKey: false }
);

module.exports = mongoose.model("notificationType", NotificationTypeSchema);
