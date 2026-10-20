const VaultRepo = require("vault/models/vault.model");
const mongoose = require("mongoose");

const VaultRepository = {

  getAll: async (req) => {
    try {
      var conditions = {};
      var and_clauses = [];

      if ( req.user.role.role == "orgAdmin") {
        and_clauses.push({
            "isDeleted": false,
            "org_code": new mongoose.Types.ObjectId(req.user.org_code._id)
        });
    }else {
        and_clauses.push({
            "isDeleted": false
        });
    }

      if (_.has(req.params, "project_code")) {
        and_clauses.push({
          project_code: new mongoose.Types.ObjectId(req.params.project_code),
        });
      }

      if (_.isObject(req.body) && _.has(req.body, "query")) {
        and_clauses.push({
          $or: [
            {
              vault_name: {
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
        sortOperator["$sort"]["_id"] = sortOrder;
      } else {
        sortOperator["$sort"]["_id"] = -1;
      }

      var aggregate = VaultRepo.aggregate([
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
          $lookup:
          {
              from: "organisations",
              localField: "org_code",
              foreignField: "_id",
              as: "org_data"
          }
      },
      { $unwind: { path: "$org_data", preserveNullAndEmptyArrays: true } },
        // {
        //   $lookup: {
        //     from: "users",
        //     localField: "updated_by",
        //     foreignField: "_id",
        //     as: "updated_by",
        //   },
        // },
        // {
        //   $unwind: "$updated_by",
        // },
        {
          $match: conditions,
        },
        sortOperator,
      ]).project({
        vault_name: 1,
        url: 1,
        "project_name":"$project_data.project_name",
        "organization":"$org_data.org_name"
      });

      let options = { page: req.body.page, limit: 5 };

      let allvault = await VaultRepo.aggregatePaginate(aggregate, options);
      return allvault;
    } catch (e) {
      throw e;
    }
  },

  getAllByField: async (params) => {
    try {
      let Records = await VaultRepo.find(params).exec();
      return Records;
    } catch (e) {
      throw e;
    }
  },
  getById: async (id) => {
    try {
      let Records = await VaultRepo.findById(id).exec();
      return Records;
    } catch (e) {
      throw e;
    }
  },

  save: async (data) => {
    try {
      let vault = await VaultRepo.create(data);

      if (!vault) {
        return null;
      }
      return vault;
    } catch (e) {
      console.log(e.message);
      throw e;
    }
  },

  getByProject: async (params) => {
    try {
      //let Records = await VaultRepo.find(params).lean().exec();
      let Records = await VaultRepo.aggregate([
        { $match: params },
        {
          $project: {
            _id: 1,
            org_code:1,
            vault_name: { $ifNull: ["$display_name", "$vault_name"] },
            product_version: 1
          }
        }
      ]);
     // console.log(Records);
      return Records;
    } catch (e) {
      console.log("Exception while reading vaults:"+e);
      throw e;
    }
  },

	getVaultFields: async (id) => {
		//    console.log(params);
		try {
			let VaultData = await VaultRepo.findById(id).select({ 
					_id: 0, 
					project_code: 0, 
					org_code: 0, 
					project_type: 0, 
					jenkins_base_url: 0, 
					jenkins_job_name: 0, 
					updated_by: 0, 
					isDeleted: 0, 
					userId: 0, 
					createdAt: 0, 
					updatedAt: 0, 
					remove_addl_fields: 0 
				}).lean().exec();
			return VaultData;
		} catch (e) {
			console.log("Exception while retrieving from vault : " + e);
			throw (e);
		}
	},

  updateById: async (data, id) => {
    try {
      let vault = await VaultRepo.findByIdAndUpdate(id, data, {
        new: true,
        upsert: true,
      }).exec();

      if(!_.isEmpty(data.remove_addl_fields)){
        data.remove_addl_fields.forEach(element => {
          vault.set(element, undefined, {strict: false} );
        });
        vault.set('remove_addl_fields', undefined, {strict: false} );
      }
      vault.save();
      return vault;
    } catch (e) {
      throw e;
    }
  }

};
module.exports = VaultRepository;
