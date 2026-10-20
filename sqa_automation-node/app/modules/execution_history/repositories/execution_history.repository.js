const EH = require('execution_history/models/execution_history.model');

const Execution = require('execution/models/execution.model');
const VaultRepo = require("vault/models/vault.model");
const TestCaseRepo = require('test_case/models/test_case.model');

const mongoose = require('mongoose');

const EHRepository = {
    save: async (data) => {
        try {
            let Records = await EH.create(data);
            if (!Records) {
                return null;
            }
            return Records;
        } catch (e) {
            throw e;
        }
    },

    getById: async (id) => {
        try {
            let Records = await EH.findById(id)
            .populate("vault", "_id, vault_name")
            .populate("test_case_id")
            .exec();
            return Records;
        } catch (e) {
            throw (e);
        }
    },

	getAllByFields: async (params) => {
        try {
            let Records = await EH.find(params).sort({ 'execution_date' : 'desc'}).exec();
            return Records;
        } catch (e) {
            throw (e);
        }
    },
    
    updateById: async (data, id) => {
        try {
            let Records = await EH.findByIdAndUpdate(id, data, {
                new: true,
                upsert: true
            }).exec();
            return Records;
        } catch (e) {
            throw (e);
        }
    },

    getHistoryPagination: async (params ) => {
        //console.log(params);
        //page = 1, limit = 10, proj_id,
        try {

            let conditions = {};
            let and_clauses = [];
            let sortOperator = {
                "$sort": {}
            };

            and_clauses.push({ "project_id": params.project_id });
            and_clauses.push({ "test_suite_id": params.test_suite_id });

            if(!_.isEmpty(params.vault_id))
                and_clauses.push({ "vault_data._id": new mongoose.Types.ObjectId(params.vault_id) });

            if (_.isObject(params) && _.has(params, 'query_field') ) {
                let query_field = params.query_field;
                if(!_.isEmpty(query_field)){
                    let query ={}
                    if(query_field == "ccInfo"){
                        and_clauses.push({
                            $or: [
                                {
                                    'ccInfo.title': {
                                        $regex: params.query_value,
                                        $options: 'i'
                                    }
                                },
                                {
                                    'ccInfo.changeControlNo': {
                                        $regex: params.query_value,
                                        $options: 'i'
                                    }
                                },
                                {
                                    'ccInfo.description': {
                                        $regex: params.query_value,
                                        $options: 'i'
                                    }
                                },
                                {
                                    'ccInfo.justification': {
                                        $regex: params.query_value,
                                        $options: 'i'
                                    }
                                },
                                {
                                    'ccInfo.runNo': {
                                        $regex: params.query_value,
                                        $options: 'i'
                                    }
                                }
                            ]
                        });

                    }else if(query_field == "runNo"){
                        and_clauses.push({
                            $or: [
                                {
                                    'ccInfo.runNo': {
                                        $regex: params.query_value,
                                        $options: 'i'
                                    }
                                }
                            ]
                        });

                    }else if(query_field == "vault_name"){
                        and_clauses.push({
                            $or: [
                                {
                                    'vault_data.vault_name': {
                                        $regex: params.query_value,
                                        $options: 'i'
                                    }
                                }
                            ]
                        });

                    }else if(query_field == "test_case_id"){
                        and_clauses.push({
                            $or: [
                                {
                                    'test_case.test_case_id': {
                                        $regex: params.query_value,
                                        $options: 'i'
                                    }
                                    }
                            ]
                        });
                    }else if(query_field == "test_case_name"){
                        and_clauses.push({
                            $or: [
                                {
                                    'test_case.test_case_name': {
                                        $regex: params.query_value,
                                        $options: 'i'
                                    }
                                }
                            ]
                        });
                    }else if(query_field == "execution_date"){
                        and_clauses.push({
                            $or: [
                                {
                                    'exec_data': { $gte: new Date(params.query_value[0]), $lte: new Date(params.query_value[1]) }
                                }
                            ]
                        });

                    }else if(query_field == "build_no"){
                        query[query_field] = params.query_value; 
                    }else {
                        query[query_field] = { $regex: params.query_value, $options: 'i' };
                    }
                        and_clauses.push(query);
                    }
            }

            conditions['$and'] = and_clauses;
           // console.log(JSON.stringify(conditions, null, 4))

            //Sort by

            if (_.has(params, 'sort_field')) {
                var sortField = params.sort_field;
                if (_.has(params, 'sort_order')) {
                    if (params.sort_order == 'desc') {
                        var sortOrder = -1;
                    } else if (params.sort_order == 'asc') {
                        var sortOrder = 1;
                    }
                }
                else {
                    var sortOrder = 1;
                }

                sortOperator["$sort"][sortField] = sortOrder;
                sortOperator["$sort"]['sortByField'] = -1;
            }else{
                sortOperator["$sort"]['sortByField'] = -1;
            }
            
            // Create aggregation pipeline
          let aggregateQuery = EH.aggregate([
            {
              $set: {
                    "start_date": "$execution_date"
                    }
            },
            {
              $unionWith: {
                coll: 'executions', 
                pipeline: []
        		}
    		},
            {
              $lookup: {
                from: 'test_cases', 
                localField: 'test_case_id', 
                foreignField: '_id', 
                as: 'test_case' 
              }
            },
            {
                $lookup: {
                  from: 'vaults', 
                  localField: 'vault', 
                  foreignField: '_id', 
                  as: 'vault_data' 
                }
              },
              {
                // Project only id and vault_name
                $addFields: {
                  vault : {
                    $map: {
                      input: '$vault_data',
                      as: 'populated',
                      in: {
                        _id: '$$populated._id', // Only include 'id'
                        vault_name: '$$populated.vault_name' // Only include 'vault_name'
                      }
                    }
                  },
                  sortByField: {
                    sortField: { $ifNull: ['$execution_date', '$createdAt'] }
                  },
                  exec_data: { $ifNull: ['$execution_date', '$createdAt'] }
                }
              },
              {
                  $unwind :{ path: "$vault", preserveNullAndEmptyArrays: true }
              },
              {
                  $match: conditions
              },            
              sortOperator
          ]).project({
            "vault_data": 0,
            "test_case_id": 0,
            "tag_id": 0,
            "sortByField": 0,
            "exec_data":0,
            "execution_date": 0
        });
      
          // Apply pagination with mongoose-aggregate-paginate
          const options = {
            page: params.page,
            limit: params.limit,
          };
      
          const result = await EH.aggregatePaginate(aggregateQuery, options);
      
          return result; // Contains data, total docs, current page, etc.
        } catch (err) {
          console.error(err);
          throw (err);
        }
      }
    
};

module.exports = EHRepository;