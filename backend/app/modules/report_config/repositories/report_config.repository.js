const mongoose = require("mongoose");
const ReportConfigRepo = require('report_config/models/report_config.model');

const ReportConfigRepository = {

  getAllByField: async (params) => {
    try {
      let Records = await ReportConfigRepo.find(params).exec();
      return Records;
    } catch (e) {
      throw e;
    }
  },

  save: async (data) => {
    try {
      let vault = await ReportConfigRepo.create(data);

      if (!vault) {
        return null;
      }
      return vault;
    } catch (e) {
      console.log(e.message);
      throw e;
    }
  },

  getByField: async (params) => {
    try {
      let Records = await ReportConfigRepo.findOne(params)
        .exec();
      return Records;
    } catch (e) {
      throw e;
    }
  },

  updateById: async (data, id) => {
    try {
      let vault = await ReportConfigRepo.findByIdAndUpdate(id, data, {
        new: true,
        upsert: true,
      }).exec();
      return vault;
    } catch (e) {
      throw e;
    }
  }

};
module.exports = ReportConfigRepository;
