const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const NotificationAuditSchema = new Schema(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: "user"
    },
    notification_id: {
      type: Schema.Types.ObjectId,
      ref: "notification"
    }
  },
  { timestamps: true, versionKey: false }
);

module.exports = mongoose.model("notificationAudit", NotificationAuditSchema);
