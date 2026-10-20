const { join, resolve } = require("path");
_ = require("underscore");
require("dotenv").config();
require("app-module-path").addPath(__dirname + "/app/modules");
config = require(resolve(join(__dirname, "app", "config")));
const WebSocket = require("ws");
const notificationRepo = require("notification/repositories/notification.repository");
const notificationAuditRepo = require("notificationAudit/repositories/notificationAudit.repository");
const notificationTypeRepo = require("notificationType/repositories/notificationType.repository");
const userRepo = require("user/repositories/user.repository");
const crypto = require("crypto");
const mongoose = require("mongoose");
const schedule = require("node-schedule");
const url = require("url");
const wss = new WebSocket.Server({ port: 7071 });

var clientMap = {};
var clientSMMap = [];

databaseInit();
SMNotification();

wss.on("close", function close() {
  // console.log("wss.Close:" + wss.clients.size);
});
wss.on("connection", async function connection(ws, req) {
  //console.log("new client connected");
  let uuid = crypto.randomUUID();

  ws.isAlive = true;

  //Read Parameters
  let parameters = url.parse(req.url, true);
  uuid =  parameters.query.user_id + uuid;
  const leave = (org) => {
    // not present: do nothing
    //console.log(uuid);
    if (!clientMap[org][uuid]) {
      return;
    }

    //Remove from SystemMaintianceClient
    let index = clientSMMap.indexOf(clientMap[org][uuid]);
    if (index > -1) { 
      clientSMMap.splice(index, 1); 
    }

    // if the one exiting is the last one, destroy the org
    if (Object.keys(clientMap[org]).length === 1) {
      delete clientMap[org];
    }
    else {
      delete clientMap[org][uuid];
    }
  };

  if (parameters.pathname == "/notification") {
    //console.log("return all active notifications");
    //create organization bucket if not exists
    if (!clientMap[parameters.query.org_code])
      clientMap[parameters.query.org_code] = {};

    if (!clientMap[parameters.query.org_code][uuid])
      clientMap[parameters.query.org_code][uuid] = ws;
    else console.log("Already exists.....");
    // let activeNotifications = await getActiveNotification(
    //   parameters.query.user_id,
    //   parameters.query.org_code
    // );
    // ws.send(JSON.stringify(activeNotifications));
  } else if (parameters.pathname == "/checklive") {
    let resp = await checkLive();
    //console.log("return check live :" + resp);
    ws.send(JSON.stringify(resp));
    clientSMMap.push(ws);
  }

  ws.on("error", console.error);

  ws.on("pong", heartbeat);

  ws.on("message", async function message(data) {

    let parameters = url.parse(req.url, true);
    console.log(parameters.pathname);
    if (parameters.pathname == "/broadcastNotification") {
      let jsondata = JSON.parse(data);
      //console.log(jsondata);
      if (jsondata.user == "Admin") {
        //console.log("sending message ..................."+jsondata.notification.org_code);
        let noti ={};
        if(jsondata.actionType == "insert"){
          noti = {
            actionType: "insert",
            data: JSON.stringify({...jsondata.notification, isRead:false}),
            notification_id: null
          }
        }else if(jsondata.actionType == "update"){
          noti = {
            actionType: "update",
            data: JSON.stringify({...jsondata.notification, isRead:false} ),
            notification_id: jsondata.notificationID
          }
        }else if(jsondata.actionType == "delete"){
          noti = {
            actionType: "delete",
            data: null,
            notification_id: jsondata.notificationID
          }
        }
        //console.log(JSON.stringify(noti));
        
        if (jsondata.notification.org_code == null) {
          wss.clients.forEach(function each(client) {
            if (client !== ws && client.readyState === WebSocket.OPEN && !clientSMMap.includes(client)) {
              client.send(JSON.stringify(noti));
            }
          });
        } else {
          if (clientMap.hasOwnProperty(jsondata.notification.org_code)) {
            let CMOrg = jsondata.notification.org_code.toString();

            for (let CMUsr in clientMap[CMOrg]) {
              //  console.log(CMUsr + ": " + clientMap[CMOrg][CMUsr]);
              if (
                clientMap[CMOrg][CMUsr] !== ws &&
                clientMap[CMOrg][CMUsr].readyState === WebSocket.OPEN
              ) {
                clientMap[CMOrg][CMUsr].send(
                  JSON.stringify(noti)
                );
              }
            }
          }
        }
        let notiType = await notificationTypeRepo.getByField({ label: "System" });
        //if Notification Type is system
        if(notiType._id.toString() == jsondata.notification.type.toString())
          SMNotification();
        
      }
    }else if (parameters.pathname == "/broadcastReadNotification") {
      let jsondata = JSON.parse(data);
      //console.log(jsondata.user);
      if (jsondata.user == "Admin") {
        //console.log("sending message ..................."+jsondata.notification.org_code);
        if (jsondata.notificationAudit.notification_id.org_code == null) {
          for (let CMOrg in clientMap) {
            for (let CMUsr in clientMap[CMOrg]) {
              if(CMUsr.startsWith(jsondata.notificationAudit.user_id.toString())){
                if (
                  clientMap[CMOrg][CMUsr] !== ws &&
                  clientMap[CMOrg][CMUsr].readyState === WebSocket.OPEN
                ) {
                  let rn = {
                    actionType: "read",
                    data: null,
                    notification_id: jsondata.notificationAudit.notification_id._id.toString()
                  }
                  clientMap[CMOrg][CMUsr].send(
                    JSON.stringify(rn)
                  );
                }
              }
            }
          };
        } else {
          if (clientMap.hasOwnProperty(jsondata.notificationAudit.notification_id.org_code)) {
            let CMOrg = jsondata.notificationAudit.notification_id.org_code.toString();
            for (let CMUsr in clientMap[CMOrg]) {
              //  console.log(CMUsr + ": " + clientMap[CMOrg][CMUsr]);
              if(CMUsr.startsWith(jsondata.notificationAudit.user_id.toString())){
                if (
                  clientMap[CMOrg][CMUsr] !== ws &&
                  clientMap[CMOrg][CMUsr].readyState === WebSocket.OPEN
                ) {
                  let rn = {
                    actionType: "read",
                    data: null,
                    notification_id: jsondata.notificationAudit.notification_id._id.toString()
                  }
                  clientMap[CMOrg][CMUsr].send(
                    JSON.stringify(rn)
                  );
                }
              }
            }
          }
        }
      }
    }
  });

  ws.on("close", (code, reason) => {
    //  console.log("ws.onClose...." + code + "-" + reason);
    Object.keys(clientMap).forEach((item) => leave(item));
  });
});

async function getActiveNotification(user_id, org_code) {
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
        {
          org_code:
            org_code == null || org_code == "null"
              ? null
              : new mongoose.Types.ObjectId(org_code),
        },
      ]
    });
    let notificationAuditRecords = await notificationAuditRepo.getAllByField({
      user_id:
        user_id == null || user_id == "null"
          ? null
          : new mongoose.Types.ObjectId(user_id)
    });
    notifications.forEach((element) => {
      if (
        JSON.stringify(notificationAuditRecords).indexOf(
          element._id.toString()
        ) > -1
      ) {
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
      // console.log(element);
    });
    return notificationList;
  } catch (e) {
    console.log("Error at getActiveNotificationData: " + e);
    return "Somthing went wrong...";
  }
}
async function SMNotification() {
  try {

    //stop all existing schedule jobs.
    let keys = Object.keys(schedule.scheduledJobs);
    for (var i = 0; i < keys.length; i++) {
      schedule.cancelJob(keys[i]);
    }

    let notiType = await notificationTypeRepo.getByField({ label: "System" });
    let notification = await notificationRepo.getAllByField({
      isDeleted: false,
      type: notiType._id,
      maintenance_edate: { $gte: new Date() }
    });
    if(notification.length > 0){  //schedule the job
      notification.forEach(item =>{
        schedule.scheduleJob(item.maintenance_sdate, async function(){
          let tmpnoti = { // on Maintenance Start DateTime
            actionType: "systemMaintenance",
            data: {"isSystemLive": false},
            notification_id: null
            };
          await pushSMNotification(tmpnoti);
        });
        
        schedule.scheduleJob(new Date(item.maintenance_sdate - 5 * 60000), async function(){
          let tmpnoti = { // before 5 mins of Maintenance Start DateTime
            actionType: "systemAlert",
            data: {message: item.maintenance_message},
            notification_id: null
           }
           await pushSMNotification(tmpnoti);
          //console.log('Welcome before schedule execution time...'+ new Date() +": -->"+item.maintenance_sdate);
        });
      } );
      
    }
    //console.log(schedule.scheduledJobs);
  } catch (e) {
    console.log("Error in checkSMNotification: " + e);
  }
}

async function pushSMNotification(notification){
  clientSMMap.forEach(client =>{
    client.send(JSON.stringify(notification))
  });

}

async function checkLive() {
  try {
    let notiType = await notificationTypeRepo.getByField({ label: "System" });
    let notification = await notificationRepo.getAllByField({
      isDeleted: false,
      type: notiType._id,
      $and: [
        { maintenance_sdate: { $lte: new Date() } },
        { maintenance_edate: { $gte: new Date() } }
      ]
    });
    if (notification.length > 0) {
      //return notification;
      return {
        isSystemLive: false,
        message: notification[0].maintenance_message
      };
    } else {
      return { isSystemLive: true };
    }
  } catch (e) {
    console.log("Error in checkLive: " + e);
    return {message:"Something went wrong!!!"};
  }
}
async function databaseInit() {
  try {
    await require(resolve(join(__dirname, "app", "database")))();
  } catch (error) {
    console.error(error);
  }
}

function heartbeat() {
  this.isAlive = true;
  console.log("heatbeat...");
}
console.log("The WebSocket server is running on port 7071.");
