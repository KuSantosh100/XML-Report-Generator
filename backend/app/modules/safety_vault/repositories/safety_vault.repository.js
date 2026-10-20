const SRSRepo = require("safety_vault/models/safety_vault.model");
const mongoose = require("mongoose");

const SRSRepository = {

 getRulesSet: async () => {
    try {
      let Records = await SRSRepo.find().select("rules_set").exec();
      return Records;
    } catch (e) {
      throw e;
    }
  },

  getRuleSetKeys: async (ruleName) => {
    try {
      let Records = await SRSRepo.find().select(ruleName).exec();
      return Records;
    } catch (e) {
      throw e;
    }
  },
  
  getById: async (id) => {
    try {
      let Records = await SRSRepo.findById(id).exec();
      return Records;
    } catch (e) {
      throw e;
    }
  }

};
module.exports = SRSRepository;
