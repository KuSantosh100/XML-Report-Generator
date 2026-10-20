const NotificationRepo = require("notification/models/notification.model");
require("notificationType/repositories/notificationType.repository");
require("organisation/repositories/organisation.repository")
const mongoose = require("mongoose");

const NotificationRepository = {

  getAll: async (req) => {
    try {
      var conditions = {};
      var and_clauses = [];

      and_clauses.push({
        isDeleted: false
      });

      and_clauses.push({endDate:{$gte:new Date()}});

      if(_.has(req.params, 'org_code'))
      {
          and_clauses.push({
              "org_code" : new mongoose.Types.ObjectId(req.params.org_code)
          });
      }

      if (_.isObject(req.body) && _.has(req.body, "query")) {
        and_clauses.push({
          $or: [
            {
              'messsage': {
                $regex: req.body.query,
                $options: "i",
              },
            },
            {
                'title': {
                    $regex: req.body.query,
                    $options: 'i'
                }
            } 
          ],
        });
      }

      conditions["$and"] = and_clauses;

      var sortOperator = {
        $sort: {},
      };

      if (_.has(req.body, "sort_field")) {
        var sortField = req.body.sort_field;
        if (_.has(req.body, "sort_order")) {
          if (req.body.sort_order == "desc") {
            var sortOrder = -1;
          } else if (req.body.sort_order == "asc") {
            var sortOrder = 1;
          }
        } else {
          var sortOrder = 1;
        }

        sortOperator["$sort"][sortField] = sortOrder;
        sortOperator["$sort"]["_id"] = sortOrder;
      } else {
        sortOperator["$sort"]["updatedAt"] = -1;
      }

      var aggregate = NotificationRepo.aggregate([
        {
          $lookup:
          {
              from: "notificationtypes",
              localField: "type",
              foreignField: "_id",
              as: "notificationType"
          }
      },
      { $unwind: { path: "$notificationType", preserveNullAndEmptyArrays: true } },
        {
          $lookup:
          {
              from: "organisations",
              localField: "org_code",
              foreignField: "_id",
              as: "org_data"
          }
      },
      { $unwind: { path: "$org_data", preserveNullAndEmptyArrays: true } },
        {
          $match: conditions,
        },
        sortOperator,
      ]);

      let options = { page: req.body.page, limit: 5 };

      let allnotifications = await NotificationRepo.aggregatePaginate(aggregate, options);
      return allnotifications;
    } catch (e) {
      throw e;
    }
  },

  getAllByField: async (params) => {
    try {
      let Records = await NotificationRepo.find(params).sort({"updatedAt": -1}).populate("type").exec();
      //console.log(JSON.stringify(Records, null, 4));
      return Records;
    } catch (e) {
      throw e;
    }
  },
  getById: async (id) => {
    try {
      let Records = await NotificationRepo.findById(id).exec();
      return Records;
    } catch (e) {
      throw e;
    }
  },

  save: async (data) => {
    try {
      let Notification = await NotificationRepo.create(data);
      Notification = await NotificationRepo.findById(Notification._id).populate("type").exec();
      //console.log("Save : "+Notification);
      if (!Notification) {
        return null;
      }
      return Notification;
    } catch (e) {
      console.log(e.message);
      throw e;
    }
  },

  updateById: async (data, id) => {
    try {
      let Notification = await NotificationRepo.findByIdAndUpdate(id, data, {
        new: true,
        upsert: true,
      }).exec();
      return Notification;
    } catch (e) {
      throw e;
    }
  }

};
module.exports = NotificationRepository;
