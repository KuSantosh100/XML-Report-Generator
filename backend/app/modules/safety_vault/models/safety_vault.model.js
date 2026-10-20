const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const mongooseAggregatePaginate = require("mongoose-aggregate-paginate");

const SRSSchema = new Schema(
  {
    rules_set : { type: Array, default: ["FDA ICSR", "EMA ICSR", "MHRA", "PMDA ICSR","SUBMISSIONS"]},
  },
  { timestamps: true, versionKey: false, strict: false }
);

// create the model for users and expose it to our app
module.exports = mongoose.model("safety_vault", SRSSchema);
