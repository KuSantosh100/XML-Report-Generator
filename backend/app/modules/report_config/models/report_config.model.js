const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ReportConfigSchema = new Schema({
  firstPage: { },
  secondPage:{},
  otherPage: {  },
  type: { type: String, default: 'Type0'  },
  logo: { type: String, default: '' },
  backgroundImage: { type: String, default: null },
  org_code: { type: Schema.Types.ObjectId, ref: 'organisation', default:null},
  template: { type: Boolean, default:false},
  xmlType: { type: String, default: 'Type0'  },
  pageMargins: { type: Array, default: [30, 70, 30, 50] }
}, { timestamps: true, versionKey: false },{ strict: false });
module.exports = mongoose.model('report_config', ReportConfigSchema);