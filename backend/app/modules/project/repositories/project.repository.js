const Project = require('project/models/project.model');
const perPage = config.PAGINATION_PERPAGE;
const mongoose = require('mongoose');

const ProjectRepository = {
    getAll: async (req) => {    
        try {
            var conditions = {};
            var and_clauses = [];

            and_clauses.push({ "isDeleted": false });
            if(_.isObject(req.body) && _.has(req.body, 'org_code'))
            {
                and_clauses.push({
                    "org_code" : new mongoose.Types.ObjectId(req.params.org_code)
                });
            }

            if (_.isObject(req.body) && _.has(req.body, 'query')) {
                and_clauses.push({
                    $or: [
                        {
                            'project_name': {
                                $regex: req.body.query,
                                $options: 'i'
                            }
                        },
                        {
                            'type': {
                                $regex: req.body.query,
                                $options: 'i'
                            }
                        }                    
                    ]
                });
            };

            if (_.isObject(req.body) && !_.has(req.body, 'projectUpdate')) {
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
                if (_.has(req.body, 'sort_order')) 
                {
                    if (req.body.sort_order == 'desc') 
                    {
                        var sortOrder = -1;
                    } else if (req.body.sort_order == 'asc') {
                        var sortOrder = 1;
                    }
                }
                else{
                    var sortOrder = 1;
                }

                sortOperator["$sort"][sortField] = sortOrder;
                sortOperator["$sort"]["_id"] = sortOrder;
            } else {
                sortOperator["$sort"]['_id'] = -1;
            }

            var aggregate = Project.aggregate([
                {
                    $lookup:{
                        from: "organisations",
                        localField: "org_code",
                        foreignField: "_id",
                        as: "org_data"
                      }
                },
                {
                    $unwind: { path: "$org_data", preserveNullAndEmptyArrays: true }
                },
                {
                    $match: conditions
                },
                sortOperator
            ]);

            let options = { page : req.body.page, limit : 5}
            
            let allProject = await Project.aggregatePaginate(aggregate, options);
            return allProject;
        } catch (e) {
            throw (e);
        }
    },

    getById: async (id) => {
        try {
            let Projects = await Project.findById(id).exec();
            return Projects;
        } catch (e) {
            throw (e);
        }
    },

    getProjectTypes: async () => {
        try {
            let projectTypes = await Project.schema.path('type').enumValues;
            return projectTypes;
        } catch (e) {
            console.log("exception while retrieving project Type Enum values");
            throw (e);
        }
    },

    getProjectTypeCodes: async () => {
        try {
            let projectTypes = await Project.schema.path('type').enumValues;
            return projectTypes;
        } catch (e) {
            console.log("exception while retrieving project Type Enum values");
            throw (e);
        }
    },

    getByField: async (params) => {
        try {
            let Projects = await Project.findOne(params).populate('org_code').lean().exec();
            return Projects;
        } catch (e) {
            throw (e);
        }
    },

    getIdByField: async (params) => {
        try {
            let Projects = await Project.findOne(params).select(" id ").exec();
            return Projects;
        } catch (e) {
            throw (e);
        }
    },

    getAllByFieldNoIcon: async (params) => {
        try {
            let Projects = await Project.find(params).sort('sortorder').select(" -projectIcon ").exec();
            return Projects;
        } catch (e) {
            throw (e);
        }
    },

    getAllByField: async (params) => {
        try {
            let Projects = await Project.find(params).sort('sortorder').exec();
            return Projects;
        } catch (e) {
            throw (e);
        }
    },

    delete: async (id) => {
        try {
            let Projects = await Project.findById(id);
            if (Projects) {
                let ProjectDelete = await Project.remove({
                    _id: id
                }).exec();
                return ProjectDelete;
            } else {
                return null;
            }
        } catch (e) {
            throw (e);
        }
    },

    deleteByField: async (field, fieldValue) => {
        //todo: Implement delete by field
    },

    updateById: async (data, id) => {
        try {
            let Projects = await Project.findByIdAndUpdate(id, data, {
                new: true,
                upsert: true
            }).exec();
            return Projects;
        } catch (e) {
            throw (e);
        }
    },

    updateByField: async (field, fieldValue, data) => {
        //todo: update by field
    },

    getAllProject: async () => {
        try {
            return await Project.find().exec();
        } catch (error) {
            return error;
        }
    },

    save: async (data) => {
        try {
            let cat = await Project.create(data);
            if (!cat) {
                return null;
            }
            return cat;
        } catch (e) {
            throw e;
        }
    },

};

module.exports = ProjectRepository;
