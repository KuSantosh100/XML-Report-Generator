const mongoose = require("mongoose");
const User = require("user/models/user.model");
const perPage = config.PAGINATION_PERPAGE;

const userRepository = {
  getAllUsers: async (req) => {
    try {
      var conditions = {};
      var and_clauses = [];

      and_clauses.push({
        isDeleted: false
      });

      if (_.isObject(req.body) && _.has(req.body, "query")) {
        and_clauses.push({
          $or: [
            {
              first_name: {
                $regex: req.body.query,
                $options: "i",
              },
            },
            {
              last_name: {
                $regex: req.body.query,
                $options: "i",
              },
            },
            {
              login_name: {
                $regex: req.body.query,
                $options: "i",
              },
            },
            {
              email: {
                $regex: req.body.query,
                $options: "i",
              },
            },
            {
              full_name: {
                $regex: req.body.query,
                $options: "i",
              },
            },
            {
              phone: {
                $regex: req.body.query,
                $options: "i",
              },
            },
          ],
        });
      }

      if (_.isObject(req.body) && !_.has(req.body, 'userUpdate')) {
        if (_.isObject(req.body) && _.has(req.body, 'status')) {
            and_clauses.push({
                "status": req.body.status
            });
        }
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
        sortOperator["$sort"]["_id"] = -1;
      }

      var aggregate = User.aggregate([
          {
            $lookup:{
                from: "roles",
                localField: "role",
                foreignField: "_id",
                as: "userRole"
              }
        },
        {
            $unwind: { path: "$userRole", preserveNullAndEmptyArrays: true }
        },
        {
          $match: conditions,
        },
        sortOperator,
      ]).project({
        first_name: 1,
        last_name: 1,
        email: 1,
        org_code: 1,
        userRole: 1,
       // is_admin: 1,
        notification_preference: 1,
        isDeleted: 1,
        status: 1
      });

      let options = { page: req.body.page, limit: 5 };

      let allUsers = await User.aggregatePaginate(aggregate, options);

      return allUsers;
    } catch (e) {
      console.log("Exception at getAllUsers : " + e);
      throw e;
    }
  },

  getUserOrgPro: async (params) => {
    try {
      let record = await User.find(params)
        .select(
          " first_name last_name email org_code role notification_preference isDeleted status "
        )
        .exec();
      if (!record) {
        return null;
      }
      return record;
    } catch (e) {
      return e;
    }
  },

  getById: async (id) => {
    // let user = await User.findById(id).populate('role')
    //   .lean()
    //   .select(
    //     " first_name last_name email org_code role notification_preference isDeleted "
    //   )
    //   .exec();

    let user = await User.aggregate([
      {$match  : {_id : id} },
      {
        $lookup : {
          from: 'roles',
          localField: 'role',
          foreignField: '_id',
          as: 'userRole'
        }
      },
      {
        $unwind :{ path: "$userRole", preserveNullAndEmptyArrays: true }
      }
    ]).project({ 
      first_name: 1,
      last_name: 1,
      full_name: 1,
      email: 1,
      org_code: 1,
      userRole: 1,
     // is_admin: 1,
      notification_preference: 1,
      isDeleted: 1,
      status: 1
    });
    try {
      if (!user) {
        return null;
      }
      return user;
    } catch (e) {
      return e;
    }
  },

  getUserById: async (id) => {
    let user = await User.findById(id)
      .populate("org_code")
      .populate("role")
      .populate("project_code")
      .exec();
    try {
      if (!user) {
        return null;
      }
      return user;
    } catch (e) {
      return e;
    }
  },

  getByField: async (params) => {
    let user = await User.findOne(params, "email first_name").exec();
    try {
      if (!user) {
        return null;
      }
      return user;
    } catch (e) {
      return e;
    }
  },

  getAllByField: async (params) => {
    let user = await User.find(params)
      .select(
        " first_name last_name email org_code role notification_preference isDeleted status "
      )
      .exec();
    try {
      if (!user) {
        return null;
      }
      return user;
    } catch (e) {
      return e;
    }
  },

  getLimitUserByField: async (params) => {
    let user = await User.find(params)
      //  .populate("role")
      .select(
        " first_name last_name email org_code role notification_preference isDeleted status "
      )
      .limit(5)
      .sort({
        _id: -1,
      })
      .exec();
    try {
      if (!user) {
        return null;
      }
      return user;
    } catch (e) {
      return e;
    }
  },

  delete: async (id) => {
    //This code should not be there
    // try {
    //   let user = await User.findById(id);
    //   if (user) {
    //     let userDelete = await User.remove({
    //       _id: id,
    //     }).exec();
    //     if (!userDelete) {
    //       return null;
    //     }
    //     return user;
    //   }
    // } catch (e) {
    //   return e;
    // }
  },

  deleteByField: async (field, fieldValue) => {
    //todo: Implement delete by field
  },

  updateById: async (data, id) => {
    try {
      let user = await User.findByIdAndUpdate(id, data, { new: true, upsert: true }).select(
        " first_name last_name email org_code role notification_preference isDeleted status "
      );
      if (!user) {
        return null;
      }
      return user;
    } catch (e) {
      return e;
    }
  },

  updateByField: async (field, fieldValue, data) => {
    try {
      let user = await User.findByIdAndUpdate(fieldValue, field, {
        new: true,
      }).select(
        " first_name last_name email org_code role notification_preference isDeleted status "
      );
      if (!user) {
        return null;
      }
      return user;
    } catch (e) {
      return e;
    }
  },

  save: async (data) => {
    try {
      let user = await User.create(data);

      if (!user) {
        return null;
      }
      return user;
    } catch (e) {
      return e;
    }
  },

  forgotPassword: async (params) => {
    try {
      let user = await User.findOne(params
      //   {
      //   email: params.email,
      //   isDeleted: false,
      //   status: "Active"
      // }
      ).exec();
      return user;
    } catch (e) {
      return e;
    }
  },

  getUser: async (id) => {
    try {
      let user = await User.findById(id).exec();
      if (!user) {
        return null;
      }
      return user;
    } catch (e) {
      return e;
    }
  },

  getUserByField: async (data) => {
    try {
      let user = await User.findOne(data)
      .populate("role")
      .populate("org_code")
      .exec();
      //console.log(JSON.stringify(user, null, 4));
      if (!user) {
        return null;
      }
      return user;
    } catch (e) {
      console.log(e);
      return e;
    }
  },
  getUserAllField: async (data) => {
    try {
      let user = await User.findOne(data)
      .populate("role")
      .populate("org_code")
      //.populate("auth_profile")
      .exec();
      if (!user) {
        return null;
      }
      return user;
    } catch (e) {
      console.log(e);
      return e;
    }
  },

  getUsersCount: async (req) => {
    try {
      var and_clauses = [];

      and_clauses.push({
        isDeleted: false
      });
      and_clauses.push({
        "user_role.role": {
          $ne: "admin",
        },
      });

      conditions["$and"] = and_clauses;
      let users = await User.aggregate([
        {
          $lookup: {
            from: "roles",
            localField: "role",
            foreignField: "_id",
            as: "user_role",
          },
        },
        {
          $unwind: "$user_role",
        },
        {
          $match: conditions,
        },
        {
          $group: {
            _id: "$user_role._id",
            name: {
              $first: "$user_role.role",
            },
            count: {
              $sum: 1,
            },
          },
        },
        {
          $sort: {
            _id: 1,
          },
        },
      ]).exec();
      return users;
    } catch (e) {
      throw e;
    }
  },

  getCount: async (params) => {
    try {
      let recordCount = await User.countDocuments(params);
      if (!recordCount) {
        return 0;
      }
      return recordCount;
    } catch (e) {
      return e;
    }
  },
};

module.exports = userRepository;
