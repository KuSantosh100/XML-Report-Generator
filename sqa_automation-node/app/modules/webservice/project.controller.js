const projectRepo = require('project/repositories/project.repository');
const mongoose = require('mongoose');
const organisationRepo = require("organisation/repositories/organisation.repository");
const sharp = require('sharp');

class projectController {
  constructor() {}

  /* @Method: create
	// @Description: project create
	*/
  async insert(req, res) {
    try {
      if (!req.body.org_code || !req.body.project_name) {
        res
          .status(201)
          .send({
            status: 201,
            data: {},
            message: "org_code Project name is required.",
          });
      } else if (!req.body.project_name) {
        res
          .status(201)
          .send({
            status: 201,
            data: {},
            message: "Project name is required.",
          });
      } else if (!req.body.org_code) {
        res
          .status(201)
          .send({ status: 201, data: {}, message: "org_code is required." });
      } else {
        req.body.org_code = new mongoose.Types.ObjectId(req.body.org_code);
        const isAvailable = await projectRepo.getByField({
          project_name: req.body.project_name,
          org_code: req.body.org_code,
          isDeleted: false,
        });

        let projectIcon = req.body.projectIcon;
        await reduceImageSize(projectIcon, 200, 200)
        .then(resizedBase64Image => {
          //  console.log('Resized Base64 Image:', resizedBase64Image);
            projectIcon = resizedBase64Image;
        })
        .catch(err => {
            console.error('Error resizing image:', err);
        });
        //console.log('Resized Base64 Image:', projectIcon);

        if (_.isEmpty(isAvailable)) {
          let obj = {
            project_name: req.body.project_name,
            org_code: req.body.org_code,
            projectIcon: projectIcon,
            type: req.body.type,
            notification_email: req.body.notification_email,
            supported_vault_release: req.body.supported_vault_release,
            release_date: req.body.release_date
          };
          const project = await projectRepo.save(obj);
          if (!_.isEmpty(project)) {
            res
              .status(200)
              .send({
                status: 200,
                data: project,
                message: "Projects added successfully",
              });
          } else {
            res
              .status(201)
              .send({
                status: 201,
                data: [],
                message: "Something went wrong!",
              });
          }
        } else {
          res
            .status(201)
            .send({ status: 201, data: [], message: "Project already exist" });
        }
      }
    } catch (error) {
      res.status(500).send({ status: 500, message: error.message });
    }
  }
  /**
   *  @Method: list
   * @param {Description} list
   */
  async projectData(req, res) {
    try {
      let qurey_data = {
        status: "Active",
        isDeleted: false
        };

      if( req.user.role.role == "orgAdmin") {
        qurey_data = {
          status: "Active",
          isDeleted: false,
          org_code: req.user.org_code._id
          };
      }
      const project_data = await projectRepo.getAllByFieldNoIcon(qurey_data);

      if (!_.isEmpty(project_data)) {
        res
          .status(200)
          .send({
            status: 200,
            data: project_data,
            message: "Project data fetched successfully",
          });
      } else {
        res
          .status(201)
          .send({ status: 201, data: [], message: "Project not available" });
      }
    } catch (error) {
      res.status(500).send({ status: 500, message: error.message });
    }
  }

  async projectDataAdvance(req, res) {
    try {
      const project_data = await projectRepo.getAll(req);
      if (!_.isEmpty(project_data)) {
        res
          .status(200)
          .send({
            status: 200,
            data: project_data,
            message: "Project data fetched successfully",
          });
      } else {
        res
          .status(201)
          .send({ status: 201, data: [], message: "Project not available" });
      }
    } catch (error) {
      res.status(500).send({ status: 500, message: error.message });
    }
  }

  async getProjectTypes(req, res) {
    try {
      let projTypes =  await projectRepo.getProjectTypes();
//      console.log(projTypes);
      if (Array.isArray(projTypes) && projTypes.length)  {
        res
          .status(200)
          .send({
            status: 200,
            data: projTypes,
            message: "Project Types fetched successfully",
          });
      } else {
        res
          .status(201)
          .send({ status: 201, data: [], message: "Something went wrong!!" });
      }
    } catch (error) {
      res.status(500).send({ status: 500, message: error.message });
    }
  }
  
  /**
   *  @Method: details
   * @param {Description} details
   */

  async projectDetails(req, res) {
    try {
      const project_data = await projectRepo.getByField({
        _id: new mongoose.Types.ObjectId(req.params.id),
      });
      if (!_.isEmpty(project_data)) {
        res
          .status(200)
          .send({
            status: 200,
            data: project_data,
            message: "Project data fetched successfully",
          });
      } else {
        res
          .status(201)
          .send({ status: 201, data: [], message: "Project not available" });
      }
    } catch (error) {
      res.status(500).send({ status: 500, message: error.message });
    }
  }

  //Method List One
  async listOne(req, res) {
    try {

      let proj = await projectRepo.getAllByField({
        org_code: new mongoose.Types.ObjectId(req.params.org_code),
        isDeleted: false,
        status: "Active",
      });
      if (!_.isEmpty(proj)) {

        let org_data = await organisationRepo.getById(req.params.org_code);
        //console.log(JSON.stringify(org_data, null, 4))
        if(org_data.org_name == "Veeva Vault Basics"){
          proj.forEach(element => {
            if (element.type == "QMS"){
              element.type = "Quality"
            }
          });
        }

        res
          .status(200)
          .send({
            status: 200,
            data: proj,
            message: "Data fetched successfully.",
          });
      } else {
        res.status(201).send({ status: 201, data: {}, message: "There are no data at this moment." });
      }
    
    } catch (e) {
      console.log(e);
      res.status(500).send({ status: 500, message: e.message });
    }
  }

  /**
   * @Method: Update
   */
  async update(req, res) {
    try {
      let projectId = new mongoose.Types.ObjectId(req.params.id) ;
      let validId = mongoose.isValidObjectId(req.params.id);
      if (validId === false) {
        res.status(201).send({
          status: 201,
          data: {},
          message: "Not valid project ID",
        });
      }
      if (_.has(req.body, "org_code")) {
        validId = mongoose.isValidObjectId(req.body.org_code);
        if (validId === false) {
          res.status(201).send({
            status: 201,
            data: {},
            message: "Not valid organization ID",
          });
        }else {
            req.body.org_code = new mongoose.Types.ObjectId(req.body.org_code);
        }
      }
      const project_data = await projectRepo.getById(projectId);;

      if (!_.isEmpty(project_data)) {
        
        const updateData = await projectRepo.updateById(req.body, projectId);
        req.body.projectUpdate = true;
        let dataWithPage = await projectRepo.getAll(req);
        if (!_.isEmpty(updateData)) {
          res
            .status(200)
            .send({
              status: 200,
              updateData: updateData,
              inPageData: dataWithPage,
              message: "Project data updated successfully",
            });
        } else {
          res
            .status(201)
            .send({ status: 201, data: {}, message: "Something is wrong!" });
        }
      } else {
        res
          .status(201)
          .send({ status: 201, data: {}, message: "Project not available" });
      }
    } catch (error) {
      res.status(500).send({ status: 500, message: error.message });
    }
  }

  async delete(req, res) {
    try {
      let validId = mongoose.isValidObjectId(req.body.id);

      if (validId === false) {
        res
          .status(201)
          .send({ status: 201, data: [], message: "Not Valid Id" });
      } else {
        const project = await projectRepo.updateById(
          { isDeleted: true },
          req.body.id
        );
        let orgall = await projectRepo.getAll(req);
        if (!_.isEmpty(project)) {
          res
            .status(200)
            .send({
              status: 200,
              data: orgall,
              delData: project,
              message: "Projects deleted successfully",
            });
        } else {
          res
            .status(201)
            .send({ status: 201, data: [], message: "Something went wrong!" });
        }
      }
    } catch (error) {
      res.status(500).send({ status: 500, message: error.message });
    }
  }
}

// Function to reduce the size of a Base64 image
async function reduceImageSize(base64String, width, height){
  // Decode the Base64 string to get the image buffer
  let imageBuffer = Buffer.from(base64String.replace('data:image/png;base64,',''), 'base64');
  // Resize the image using sharp
  const resizedImageBuffer = await sharp(imageBuffer)
      .resize(width, height)  // Set the desired width and height
      .toBuffer();

  // Convert the resized image back to Base64
  let resizedBase64Image = resizedImageBuffer.toString('base64');
  return 'data:image/png;base64,' + resizedBase64Image;
}

module.exports = new projectController();