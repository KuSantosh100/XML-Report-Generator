const PSRepo = require('project_setting/models/project_setting.model');
const perPage = config.PAGINATION_PERPAGE;
const mongoose = require("mongoose");

const ProjectSettingRepository = {
  getAll: async (req) => {
    try {
      var conditions = {};
      var and_clauses = [];

      and_clauses.push({
        isDeleted: false,
      });

      if (_.has(req.params, "project_code")) {
        and_clauses.push({
          project_code: new mongoose.Types.ObjectId(req.params.project_code),
        });
      }

      if (_.isObject(req.body) && _.has(req.body, "query")) {
        and_clauses.push({
          $or: [
            {
              setting_name: {
                $regex: req.body.query,
                $options: "i",
              },
            },
            {
              setting_value: {
                $regex: req.body.query,
                $options: "i",
              },
            },
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
        sortOperator["$sort"]["project_code"] = sortOrder;
      } else {
        sortOperator["$sort"]["project_code"] = sortOrder;
        sortOperator["$sort"]["_id"] = -1;
      }

      var aggregate = PSRepo.aggregate([
        {
          $lookup: {
            from: "projects",
            localField: "project_code",
            foreignField: "_id",
            as: "project_data",
          },
        },
        {
          $unwind: "$project_data",
        },
        {
          $match: conditions,
        },
        sortOperator,
      ]);

      // var options = {
      //     page: req.body.pagination.page,
      //     limit: req.body.pagination.perpage
      // };

      let options = { page: req.body.page, limit: 5 };

      let allSetting = await PSRepo.aggregatePaginate(aggregate, options);
      return allSetting;
    } catch (e) {
      throw e;
    }
  },

  getById: async (id) => {
    try {
      let Records = await PSRepo.findById(id).exec();
      return Records;
    } catch (e) {
      throw e;
    }
  },

  getByField: async (params) => {
    try {
      let Records = await PSRepo.findOne(params)
        .populate("project_code")
      //  .populate("updated_by")
        .lean()
        .exec();
      return Records;
    } catch (e) {
      throw e;
    }
  },

  getAllByField: async (params) => {
    try {
      let Records = await PSRepo.find(params).exec();
      return Records;
    } catch (e) {
      throw e;
    }
  },

  save: async (data) => {
    try {
      let setting = await PSRepo.create(data);

      if (!setting) {
        return null;
      }
      return setting;
    } catch (e) {
      console.log(e.message);
      throw e;
    }
  },

  updateById: async (data, id) => {
    try {
      let setting = await PSRepo.findByIdAndUpdate(id, data, {
        new: true,
        upsert: true,
      }).exec();
      return setting;
    } catch (e) {
      throw e;
    }
  }

};

module.exports = ProjectSettingRepository;
