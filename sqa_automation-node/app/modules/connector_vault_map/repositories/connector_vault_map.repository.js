const VaultMapRepo = require("connector_vault_map/models/connector_vault_map.model");
const mongoose = require("mongoose");

const VaultMapRepository = {

  getAllByField: async (params) => {
    try {
      let Records = await VaultMapRepo.find(params).exec();
      return Records;
    } catch (e) {
      throw e;
    }
  },
  getById: async (id) => {
    try {
      let Record = await VaultMapRepo.findById(id).exec();
      return Record;
    } catch (e) {
      throw e;
    }
  },

  save: async (data) => {
    try {
      let vaultMap = await VaultMapRepo.create(data);

      if (!vaultMap) {
        return null;
      }
      return vaultMap;
    } catch (e) {
      console.log(e.message);
      throw e;
    }
  }



};
module.exports = VaultMapRepository;
