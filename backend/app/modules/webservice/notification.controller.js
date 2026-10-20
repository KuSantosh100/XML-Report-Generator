const notificationRepo = require("notification/repositories/notification.repository");
const notificationAuditRepo = require("notificationAudit/repositories/notificationAudit.repository");
const notificationTypeRepo = require("notificationType/repositories/notificationType.repository");
const userRepo = require("user/repositories/user.repository");
const mongoose = require("mongoose");
const WebSocket = require("ws");

class NotificationController {
  constructor() {}

  async listAdvance(req, res) {
    try {
      let notification = await notificationRepo.getAll(req);

      if (!_.isEmpty(notification)) {
        res.status(200).send({ status: 200, data: notification, message: 'Notification data fetched successfully.' });
      } else {
        res.status(201).send({ status: 201, data: {}, message: 'There are no data at this moment.' });
      }
    } catch (e) {
      res.status(500).send({ status: 500, message: e.message });
    }
  }

  async checkLive(req, res) {
    try {
      let notiType = await notificationTypeRepo.getByField({label: "System" });
      let notification = await notificationRepo.getAllByField({
        isDeleted: false,
        type: notiType._id,
        $and: [
          { maintenance_sdate: { $lte: new Date() } },
          { maintenance_edate: { $gte: new Date() } },
        ]
      });
      if (notification.length > 0) {
        res.status(200).send({ status: 200,
          data: {isSystemLive: false, message: notification[0].maintenance_message},
          message: 'System maintenance is in progress...' });
      } else {
        res.status(201).send({ status: 201, data: {isSystemLive: true}, message: 'System is live.' });
      }
    } catch (e) {
      console.log("Error in notifications: " + error);
      res.status(500).send({ status: 500, message: e.message });
    }
  }

  async getNotificationTypes(req, res) {
    try {
      let notiTypes = await notificationTypeRepo.getAll();
      if (notiTypes) {
        res.status(200).send({ status: 200, data: notiTypes, message: 'Notification Types fetched successfully.' });
      } else {
        res.status(201).send({ status: 201, data: [], message: 'Something went wrong!!' });
      }
    } catch (error) {
      res.status(500).send({ status: 500, message: error.message });
    }
  }

  // async notifications(req) {
  //   try {
  //     let MessagesRecords = await notificationRepo.getAllByField({
  //       isDeleted: false,
  //       $or: [
  //         { org_code: null },
  //         { org_code: new mongoose.Types.ObjectId(req.params.org_code) },
  //       ],
  //     });

  //     if (MessagesRecords) {
  //       return {
  //         status: 200,
  //         data: MessagesRecords,
  //         message: "Data fetched successfully.",
  //       };
  //     } else {
  //       return {
  //         status: 201,
  //         data: {},
  //         message: `There are no data at this moment.`,
  //       };
  //     }
  //   } catch (e) {
  //     console.log("Error in notifications: " + error);
  //     return { status: 500, message: e.message };
  //   }
  // }

  async insert(req, res) {
    try {
      if(_.isObject(req.body) && _.has(req.body, 'org_code')) {
        req.body.org_code = new mongoose.Types.ObjectId(req.body.org_code);
      } else req.body.org_code = null;

      let data = {
        title: req.body.title,
        message: req.body.message,
        type: req.body.type,
        startDate: req.body.startDate,
        endDate: req.body.endDate,
        org_code: req.body.org_code,
        maintenance_sdate: req.body.maintenance_sdate,
        maintenance_edate: req.body.maintenance_edate ,
        maintenance_message: req.body.maintenance_message
      };

      let notificationsInfo = await notificationRepo.save(data);
      if (!_.isEmpty(notificationsInfo)) {
        await pushNotificationWS(notificationsInfo,"insert", notificationsInfo._id.toString());
        res.status(200).send({ status: 200, data: [], message: 'Notification successfully saved.' });
      } else {
        res.status(201).send({ status: 201, data: [], message: 'Something went wrong!!' });
      }
    } catch (error) {
      console.log("Error in NotificationController.insert: " + error);
      res.status(500).send({ status: 500, message: error.message });
    }
  }

  async AuditInsert(req, res) {
    try {
      if (!_.isEmpty(req.body.user_id)) {
        req.body.user_id = new mongoose.Types.ObjectId(req.body.user_id);
      } else {
        res.status(201).send({ status: 201, data: [], message: 'required User ID' });
      }
      if (!_.isEmpty(req.body.notification_id)) {
        req.body.notification_id = new mongoose.Types.ObjectId(req.body.notification_id );
      } else {
        res.status(201).send({ status: 201, data: [], message: 'Required notification ID' });
      }
      let data = {
        user_id: req.body.user_id,
        notification_id: req.body.notification_id
      };

      let notificationsAuditInfo = await notificationAuditRepo.save(data);
      if (!_.isEmpty(notificationsAuditInfo)) {
        //console.log(JSON.stringify(notificationsAuditInfo));
        await pushActReadNotificationWS(notificationsAuditInfo);
        res.status(200).send({ status: 200, data: notificationsAuditInfo, message: 'Notification Audit successfully saved.' });
      } else {
        res.status(201).send({ status: 201, data: [], message: 'Something went wrong!!' });
      }
    } catch (error) {
      console.log("Error in NotificationController.AuditInsert: " + error);
      res.status(500).send({ status: 500, message: error.message });
    }
  }

  async update(req, res) {
    try {
      let notificationId = req.params.id;
      let notification = await notificationRepo.getById({
        _id: req.params.id
      });
      //console.log(req.body);
      if (!_.isEmpty(notification)) {

        let delinfo = await notificationRepo.updateById(
          { isDeleted: true,
            del_reason:"update for " + notificationId }, notificationId);
      
        let data = {
          title: req.body.title,
          message: req.body.message,
          type: req.body.type,
          startDate: req.body.startDate,
          endDate: req.body.endDate,
          org_code: req.body.org_code,
          maintenance_sdate: req.body.maintenance_sdate,
          maintenance_edate: req.body.maintenance_edate ,
          maintenance_message: req.body.maintenance_message
        }
        let notificationdata = await notificationRepo.save(data);

        // let notificationdata = await notificationRepo.updateById(
        //   req.body,
        //   notificationId
        // );

        if (!_.isEmpty(notificationdata)) {
          await pushNotificationWS(notificationdata, "update", notificationId);
          res.status(200).send({ status: 200, data: notificationdata, message: 'Notification data successfully saved.' });
        } else {
          res.status(201).send({ status: 201, data: [], message: 'Something went wrong!!' });
        }
      } else {
        res.status(201).send({ status: 201, data: [], message: 'There are no data at this moment.' });
      }
    } catch (error) {
      res.status(500).send({ status: 500, message: error.message });
    }
  }

  async delete(req, res) {
    try {
      let delData = await notificationRepo.updateById(
        { isDeleted: true },
        req.params.id
      );

      let notification = await notificationRepo.getAll(req);

      if (notification) {
        await pushNotificationWS(delData, "delete", delData._id.toString());
        res.status(200).send({ status: 200, data: notification, message: 'Data deleted successfully.' });
      } else {
        res.status(201).send({ status: 201, data: {}, message: 'There are no data at this moment.' });
      }
    } catch (e) {
      res.status(500).send({ status: 500, message: e.message });
    }
  }

  async notificationsDetails(req, res) {
    try {
      let notification = await notificationRepo.getById({
        _id: new mongoose.Types.ObjectId(req.params.id),
      });

      if (notification) {
        res.status(200).send({ status: 200, data: notification, message: 'Data fetched successfully.' });
      } else {
        res.status(201).send({ status: 201, data: {}, message: 'There are no data at this moment.' });
      }
    } catch (e) {
      console.log("Error at notificationsDetails: " + e);
      res.status(500).send({ status: 500, message: e.message });
    }
  }

  async getActiveNotification(req, res) {
    try {
      let notificationList = new Array();
      let notifications = await notificationRepo.getAllByField({
        isDeleted: false,
        $and: [
          { startDate: { $lte: new Date() } },
          { endDate: { $gte: new Date() } }
        ],
        $or: [
          { org_code: null },
          { org_code: (req.params.org_code == null|| req.params.org_code == 'null') ? null : new mongoose.Types.ObjectId(req.params.org_code) }
        ],
      });
      let notificationAuditRecords =  await notificationAuditRepo.getAllByField({
        user_id: new mongoose.Types.ObjectId(req.params.user_id)
      });

      notifications.forEach( (element) =>  {
        if((JSON.stringify(notificationAuditRecords)).indexOf(element._id.toString()) > -1){
          notificationList.push({
            _id: element._id,
            title: element.title,
            message: element.message,
            type: element.type,
            isRead: true,
          });
        } else {
          notificationList.push({
            _id: element._id,
            title: element.title,
            message: element.message,
            type: element.type,
            isRead: false,
          });
        }
        //  console.log(element);
      });
      res.status(200).send({ status: 200, data: notificationList, message: 'Data fetched successfully.' });
    } catch (e) {
      console.log("Error at getActiveNotificationData: " + e);
      res.status(500).send({ status: 500, message: e.message });
    }
  }
}

async function pushNotificationWS(notificationsInfo,act, notifId) {
  if(notificationsInfo.startDate  <= new Date() && notificationsInfo.endDate >= new Date()){
    process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;
    let hostname = process.env.LOGIN_URL;
    hostname = hostname.replace("https","wss");
    const ws = new WebSocket(hostname+"/wss2/broadcastNotification");
  //  ws.binaryType = "arraybuffer";
    ws.on('error', console.error);
    ws.on('open', () => {
      let resp = {
        user: "Admin",
        actionType:act,
        notificationID: notifId,
        notification: notificationsInfo
      };
      //console.log(resp);
      ws.send(JSON.stringify(resp));
    });
    ws.on('close', function clear() {
      });
  }else{
    console.log("Not active notification: "+notificationsInfo._id +" action : "+act);
  }

}

async function pushActReadNotificationWS(auditrecord) {
//  if(notificationsInfo.startDate  <= new Date() && notificationsInfo.endDate >= new Date()){
  
    process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;
    let hostname = process.env.LOGIN_URL;
    hostname = hostname.replace("https","wss");
    const ws = new WebSocket(hostname+"/wss2/broadcastReadNotification");
  //  ws.binaryType = "arraybuffer";
    ws.on('error', console.error);
    ws.on('open', () => {
      let resp = {
        user: "Admin",
        notificationAudit: auditrecord
      };
      //console.log(resp);
      ws.send(JSON.stringify(resp));
    });
    ws.on('close', function clear() {
      });
  // }else{
  //   console.log("Not active notification: "+notificationsInfo._id);
  // }

}

module.exports = new NotificationController();
