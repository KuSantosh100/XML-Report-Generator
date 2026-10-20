const express = require("express");
const router = express.Router();
const notificationController = require("webservice/notification.controller");
const APIValidation = require("util/roleCheck")

router.all("/notification*", auth.authenticateAPI);

router.get("/checkLive", notificationController.checkLive);

//List All notifications with pagniation
router.post( "/notification/list-advance", APIValidation.superAdmin, notificationController.listAdvance);

//Insert
router.post("/notification/insert", APIValidation.superAdmin, notificationController.insert);

router.get( "/notification/details/:id", APIValidation.superAdmin, notificationController.notificationsDetails);

//Update
router.post( "/notification/update/:id", APIValidation.superAdmin, notificationController.update);

router.post( "/notification/delete/:id", APIValidation.superAdmin, notificationController.delete);

router.get( '/notification/notification-types',  notificationController.getNotificationTypes);

//Insert
router.post( "/notification/read", notificationController.AuditInsert);

router.get( "/notification/active/:user_id/:org_code", notificationController.getActiveNotification);

module.exports = router;