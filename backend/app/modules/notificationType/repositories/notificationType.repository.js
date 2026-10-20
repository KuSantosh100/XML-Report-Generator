const NotificationTypeRepo = require("notificationType/models/notificationType.model");
const mongoose = require("mongoose");

const NotificationTypeRepository = {

  getByField: async (params) => {
    try {
      let Records = await NotificationTypeRepo.findOne(params).exec();
      return Records;
    } catch (e) {
      throw e;
    }
  },

  getAll: async () => {
    try {
        return await NotificationTypeRepo.find().exec();
    } catch (error) {
        return error;
    }
},
  getById: async (id) => {
    try {
      let Records = await NotificationTypeRepo.findById(id).exec();
      return Records;
    } catch (e) {
      throw e;
    }
  },
  save: async (data) => {
    try {
      let NotificationType = await NotificationTypeRepo.create(data);

      if (!NotificationType) {
        return null;
      }
      return NotificationType;
    } catch (e) {
      console.log(e.message);
      throw e;
    }
  }

};
module.exports = NotificationTypeRepository;
