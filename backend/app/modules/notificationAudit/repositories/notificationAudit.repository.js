const NotificationAuditRepo = require("notificationAudit/models/notificationAudit.model");
const mongoose = require("mongoose");

const NotificationAuditRepository = {

  getAllByField: async (params) => {
    try {
      let Records = await NotificationAuditRepo.find(params).select("notification_id").lean().exec();
      return Records;
    } catch (e) {
      throw e;
    }
  },
  save: async (data) => {
    try {
      let NotificationAudit = await NotificationAuditRepo.create(data);
      NotificationAudit = await NotificationAuditRepo.findById(NotificationAudit._id).populate("notification_id").exec();
      //console.log("Save :"+NotificationAudit);
      if (!NotificationAudit) {
        return null;
      }
      return NotificationAudit;
    } catch (e) {
      console.log(e.message);
      throw e;
    }
  }

};
module.exports = NotificationAuditRepository;
