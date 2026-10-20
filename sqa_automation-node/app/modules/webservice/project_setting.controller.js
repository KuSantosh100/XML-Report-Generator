const settingsRepo = require('project_setting/repositories/project_setting.repository');
const projectRepo = require('project/repositories/project.repository');
const mongoose = require('mongoose');

//var slugify = require('slugify');

class settingsController {
  constructor() { }

  async listAdvance(req, res) {
    try {
      let setting = await settingsRepo.getAll(req);
     
      if (!_.isEmpty(setting)) {
        res.status(200).send({ status: 200, data: setting, message: 'Data fetched successfully.' });
      } else {
        res.status(201).send({ status: 201, data: {}, message: 'There are no data at this moment.' });
      }
    } catch (e) {
			res.status(500).send({ status: 500, message: e.message });
    }
  };

  async settingsDetails(req, res) {
    try {
      let setting = await settingsRepo.getByField({
        _id : new mongoose.Types.ObjectId(req.params.id)
      });
     
      if (!_.isEmpty(setting)) {
        res.status(200).send({ status: 200, data: setting, message: 'Project Setting data fetched successfully' });
      } else {
        res.status(201).send({ status: 201, data: [], message: 'No data found' });
      }
    } catch (e) {
      res.status(500).send({ status: 500, message: error.message });
    }
  };

  /** @Method: create
	*   @Description: Project Setting create
	*/
	async insert (req, res) {
		try {
     // console.log("req.body.project_code :"+ req.body.project_code)
            if (!req.body.project_code) {
              res.status(201).send({ status: 201, data: [], message: 'Project code is required.' });
            } else if (!req.body.setting_name) {
              res.status(201).send({ status: 201, data: [], message: 'Project setting name is required' });
            } else if (!req.body.setting_value) {
              res.status(201).send({ status: 201, data: [], message: 'Project setting value is required.' });
            }else {
                req.body.project_code = new mongoose.Types.ObjectId(req.body.project_code);
                req.body.updated_by = req.user._id;

                const ProjectData = await projectRepo.getById(req.body.project_code);
            
                if(!_.isEmpty(ProjectData)){
                  // var paSlug = slugify(req.body.setting_name, {
                  //   replacement: '_',
                  //   remove: /[*+~.()'"!:@]/g,
                  //   lower: true,      // convert to lower case, defaults to `false`
                  //   strict: false,     // strip special characters except replacement, defaults to `false`
                  // });
                  // req.body.setting_slug = paSlug;
                  var settingsInfo = await settingsRepo.save(req.body);
                  res.status(200).send({ status: 200, data: settingsInfo, message: 'Project settings successfully saved.' });
                }else{
                  res.status(201).send({ status: 201, data: [], message: 'Project is not exist.' });
                }
		     }
        }
        catch (error) {
          res.status(500).send({ status: 500, message: error.message });
        }
	};

  async update (req, res) {
		try {
        let projectSettingId = req.params.id;
        let setting = await settingsRepo.getById(new mongoose.Types.ObjectId(req.params.id));
          if(!_.isEmpty(setting)){
            req.body.updated_by = req.user._id;
            let settingdata = await settingsRepo.updateById(req.body, projectSettingId);

            if(!_.isEmpty(settingdata)){
                res.status(200).send({ status: 200, data: settingdata, message: 'Project Setting data updated successfully' });
              }else{
                res.status(201).send({ status: 201, data: [], message: 'Something is wrong!' });
              }
          }else{
            res.status(201).send({ status: 201, data: [], message: 'No data found' });
          }
		}
		catch (error) {
      res.status(500).send({ status: 500, message: error.message });
		}
	};

  async delete(req, res) {
    try {
      let delData = await settingsRepo.updateById({isDeleted : true},req.params.id);
      let setting = await settingsRepo.getAll(req);

      if (!_.isEmpty(setting)) {
        res.status(200).send({ status: 200, data: setting, delData: delData, message: 'Project Setting data deleted successfully.' });
      } else {
        res.status(201).send({ status: 201, data: [], message: 'No data found' });
      }
    } catch (e) {
      res.status(500).send({ status: 500, message: error.message });
    }
  };

}

module.exports = new settingsController();