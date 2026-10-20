const TestCaseRepo = require('test_case/models/test_case.model');
const perPage = config.PAGINATION_PERPAGE;
const mongoose = require('mongoose');

const TestCaseRepository = {
    getAll: async (req) => {
        try {
            var conditions = {};
            var and_clauses = [];

            if (req.user.role.role == "orgAdmin") {
                and_clauses.push( { 
                    $and: [ { "test_suite_data.org_code":  { $eq:  new mongoose.Types.ObjectId(req.user.org_code._id) }},
                            { "test_suite_data.isDeleted":  { $eq:  false }},
                            { "isDeleted":  { $eq:  false }}
                          ] });
            }else {  
                and_clauses.push( { 
                    $and: [{ "test_suite_data.isDeleted":  { $eq:  false }},
                            { "isDeleted":  { $eq:  false }}
                          ] });
            }

            if (_.isObject(req.body) && _.has(req.body, 'query')) {
                and_clauses.push({
                    $or: [
                        {
                            'test_case_name': {
                                $regex: req.body.query,
                                $options: 'i'
                            }
                        },
                        {
                            'release_no': {
                                $regex: req.body.query,
                                $options: 'i'
                            }
                        },
                        {
                            'test_suite_data.suite_name': {
                                $regex: req.body.query,
                                $options: 'i'
                            }
                        },
                        {
                            'release_date': {
                                $regex: req.body.query,
                                $options: 'i'
                            }
                        },
                        {
                            'tag_id': {
                                $regex: req.body.query,
                                $options: 'i'
                            }
                        }

                    ]
                });

            };

            if (_.isObject(req.body) && !_.has(req.body, 'testCaseUpdate')) {
                if (_.isObject(req.body) && _.has(req.body, 'status')) {
                    and_clauses.push({
                        "status": req.body.status
                    });
                }
            }
            conditions['$and'] = and_clauses;

            var sortOperator = {
                "$sort": {}
            };

            if (_.has(req.body, 'sort_field')) {
                var sortField = req.body.sort_field;
                if (_.has(req.body, 'sort_order')) {
                    if (req.body.sort_order == 'desc') {
                        var sortOrder = -1;
                    } else if (req.body.sort_order == 'asc') {
                        var sortOrder = 1;
                    }
                }
                else {
                    var sortOrder = 1;
                }

                sortOperator["$sort"][sortField] = sortOrder;
                sortOperator["$sort"]["_id"] = sortOrder;
            } else {
                sortOperator["$sort"]['_id'] = -1;
            }

            var aggregate = TestCaseRepo.aggregate([{
                $lookup:
                {
                    from: "test_suites",
                    localField: "test_suite_code",
                    foreignField: "_id",
                    as: "test_suite_data"
                }
            },
            { $unwind: { path: "$test_suite_data", preserveNullAndEmptyArrays: true } },
            {
                $match: conditions
            },
                sortOperator
            ]).project({
                "test_suite_code": 0
            });

            let options = { page: req.body.page, limit: 5 }

            let allTestCases = await TestCaseRepo.aggregatePaginate(aggregate, options);
            return allTestCases;
        } catch (e) {
            throw (e);
        }
    },

    getById: async (id) => {
        try {
            let testcases = await TestCaseRepo.findById(id).exec();
            return testcases;
        } catch (e) {
            throw (e);
        }
    },

    getByIds: async (ids) => {
        try {
            let testCases = await TestCaseRepo.find({_id: { $in: ids}}).exec();
            return testCases;
        } catch (e) {
            throw (e);
        }
    },

    getByField: async (params) => {
        try {
            let testCases = await TestCaseRepo.findOne(params).populate('test_suite_code').lean().exec();
            return testCases;
        } catch (e) {
            throw (e);
        }
    },

    getByFieldOnly: async (params) => {
        try {
            let testCases = await TestCaseRepo.findOne(params).lean().exec();
            return testCases;
        } catch (e) {
            throw (e);
        }
    },

    getAllByField: async (params) => {
        try {
            let testCases = await TestCaseRepo.find(params).exec();
            return testCases;
        } catch (e) {
            throw (e);
        }
    },

    updateById: async (data, id) => {
        try {
            let testCases = await TestCaseRepo.findByIdAndUpdate(id, data, {
                new: true,
                upsert: true
            }).exec();
            return testCases;
        } catch (e) {
            throw (e);
        }
    },

    updateByField: async (filter, data) => {
        try {
            let testCases = await TestCaseRepo.updateOne(filter,{ $set: data } ).exec();
            return testCases;
        } catch (e) {
            throw (e);
        }
    },
    updateByFieldByAction: async ( filter, data) => {
        try {
           // console.log(" filter :"+ JSON.stringify(filter) +"\ndata: "+JSON.stringify(data) );

            let testCases = await TestCaseRepo.updateOne(filter,data ).exec();
            return testCases;
        } catch (e) {
            throw (e);
        }
    },

    save: async (data) => {
        try {
            let testCases = await TestCaseRepo.create(data);
            if (!testCases) {
                return null;
            }
            return testCases;
        } catch (e) {
            throw e;
        }
    }
};

module.exports = TestCaseRepository;