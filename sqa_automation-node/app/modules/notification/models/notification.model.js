const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const mongooseAggregatePaginate = require("mongoose-aggregate-paginate");

const NotificationSchema = new Schema(
  {
    title: { type: String, default: "" },
    message: { type: String, default: "" },
    org_code: {
      type: Schema.Types.ObjectId,
      ref: "organisation",
      default: null,
    },
    type: { 
      type: Schema.Types.ObjectId,
      ref: "notificationType"
    },
    maintenance_message: {type: String, default: ""},
    maintenance_sdate: {type: Date, default: null},
    maintenance_edate:{type: Date, default: null},
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date, default: null },
    isDeleted: { type: Boolean, default: false, enum: [true, false] },
    del_reason:{type: String, default: ""}
  },
  { timestamps: true, versionKey: false }
);

NotificationSchema.plugin(mongooseAggregatePaginate);
module.exports = mongoose.model("notification", NotificationSchema);
