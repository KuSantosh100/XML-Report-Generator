const TestSuite = require('test_suite/models/test_suite.model');
const perPage = config.PAGINATION_PERPAGE;
const mongoose = require("mongoose");

const TestSuiteRepository = {
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

            if (_.isObject(req.body) && _.has(req.body, 'query')) {
                and_clauses.push({
                    $or: [
                        {
                            'suite_name': {
                                $regex: req.body.query,
                                $options: 'i'
                            }
                        },
                        {
                            'org_data.org_name': {
                                $regex: req.body.query,
                                $options: 'i'
                            }
                        },
                        {
                            'project_data.project_name': {
                                $regex: req.body.query,
                                $options: 'i'
                            }
                        },
                        {
                            'suite_id': {
                                $regex: req.body.query,
                                $options: 'i'
                            }
                        }

                    ]
                });

            };

            if (_.isObject(req.body) && !_.has(req.body, 'testSuitUpdate')) {
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

            var aggregate = TestSuite.aggregate([
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
                    $lookup:
                    {
                        from: "projects",
                        localField: "project_code",
                        foreignField: "_id",
                        as: "project_data"
                    }
                },
                { $unwind: { path: "$project_data", preserveNullAndEmptyArrays: true } },
                {
                    $match: conditions
                },
                sortOperator
            ]).project({
                "project_data.projectIcon": 0
            });

            // var options = {
            //     page: req.body.pagination.page,
            //     limit: req.body.pagination.perpage
            // };

            let options = { page: req.body.page, limit: 5 }

            let allTestSuite = await TestSuite.aggregatePaginate(aggregate, options);
            return allTestSuite;
        } catch (e) {
            throw (e);
        }
    },

    getById: async (id) => {
        try {
            let TestSuites = await TestSuite.findById(id).exec();
            return TestSuites;
        } catch (e) {
            throw (e);
        }
    },

    getByFieldNoIcon: async (params) => {
        try {
           let TestSuites = await TestSuite.findOne(params).populate('org_code').populate('project_code', '-projectIcon').lean().exec();
           return TestSuites;
        } catch (e) {
            throw (e);
        }
    },
    
    getByField: async (params) => {
        try {
            let TestSuites = await TestSuite.findOne(params).populate('org_code').populate('project_code').lean().exec();
            return TestSuites;
        } catch (e) {
            throw (e);
        }
    },

    getByProject: async (params) => {
        try {
            let TestSuites = await TestSuite.find(params).lean().exec();
            return TestSuites;
        } catch (e) {
            throw (e);
        }
    },

    getAllByField: async (params) => {
        try {
            let TestSuites = await TestSuite.find(params).exec();
            return TestSuites;
        } catch (e) {
            throw (e);
        }
    },

    delete: async (id) => {
        try {
            let TestSuites = await TestSuite.findById(id);
            if (TestSuites) {
                let TestSuiteDelete = await TestSuite.remove({
                    _id: id
                }).exec();
                return TestSuiteDelete;
            } else {
                return null;
            }
        } catch (e) {
            throw (e);
        }
    },

    updateById: async (data, id) => {
        try {
            let TestSuites = await TestSuite.findByIdAndUpdate(id, data, {
                new: true,
                upsert: true
            }).exec();
            return TestSuites;
        } catch (e) {
            throw (e);
        }
    },

    updateByField: async (field, fieldValue, data) => {
        //todo: update by field
    },

    save: async (data) => {
        try {
            let TestSuites = await TestSuite.create(data);
            if (!TestSuites) {
                return null;
            }
            return TestSuites;
        } catch (e) {
            throw e;
        }
    },

};

module.exports = TestSuiteRepository;