const mongoose = require("mongoose");
const userRepo = require("user/repositories/user.repository");
const roleRepo = require("role/repositories/role.repository");
const userModel = require("user/models/user.model.js");
const AuthProfile = require('auth_profile/repositories/auth_profile.repository');
const mailer = require("../util/mailer.js");
const User = new userModel();
const jwt = require("jsonwebtoken");
var CryptoJS = require('crypto-js');

class UserController {
  constructor() {}

  /* @Method: checkUser
     @Description: check user authentication module
 */
  async checkUser(req, res) {
      try {
        let user = await userRepo.getUserAllField({
          email: { $regex: "^" + req.body.email.trim() + "$", $options: "i" },
          isDeleted: false,
          status: "Active"
        });

        if (!_.isEmpty(user)) {
         // console.log("User : "+JSON.stringify(user, null, 4));
          let auth =  await AuthProfile.getByField({org_code: user.org_code._id});

          //console.log("auth : "+JSON.stringify(auth, null, 4));
          if (user.security_profile == "okta" ) {
              res.status(200).send({ status: 200, data: {userType: "okta", redirectOrg: user.org_code._id, redirectUrl: "/user/sso/login/"+user.org_code._id, logoutUrl: auth.logoutUrl + process.env.LOGIN_URL}, message: "Successfully reterived details." })
            }else{
              res.status(200).send({ status: 200, data: {userType: "basic", redirectOrg: user.org_code._id, redirectUrl: "/user/login"}, message: "Successfully reterived details." })
            }
        } else {
          res.status(201).send( { status: 201, data: {}, message: "Email not found in V-Assure." });
        }
      } catch (e) {
        //throw e;
        console.log("Error in checkUser: " + e);
        res.status(500).send( { status: 500, data: {}, message: e.message });
      }
   }

   async SSOLogin(req, res ) {
    if (!req.isAuthenticated()) {
      //console.log('----->User not authenticated');
     // return res.status(401).send( { status: 401, data: {}, message: "Unauthorized user." });
     return res.redirect(process.env.LOGIN_URL);
  } else {
      //console.log("Authenticated User------------->"+JSON.stringify(req.user, null, 4));
      try {
        //   console.log(req.body.email.trim());
           let user = await userRepo.getUserByField({
             email: { $regex: "^" + req.user.nameID.trim() + "$", $options: "i" },
             isDeleted: false,
             status: "Active"
           });
           if (!_.isEmpty(user)) {
               const payload = { id: user._id };
               const token = jwt.sign(payload, config.jwtSecret, {
                 expiresIn: parseInt(process.env.LOGIN_SESSION_TOKEN_EXPIRY),//86400,
               });
               var datetime = new Date();
               var query = {
                 last_login: datetime,
               };
               await userRepo.updateById(query, user._id);
               let usr = await filterUserDetailed(user)
               let auth =  await AuthProfile.getByField({org_code: user.org_code._id});
               usr.logoutUrl = auth.logoutUrl + process.env.LOGIN_URL;

               return res.status(200).send( { status: 200, data: usr, token: token, message: "Logged in successfully." });
           } else {
             return res.status(201).send( { status: 201, data: {}, message: "User not found in V-Assure." });
           }
         } catch (e) {
           console.log("Error SSO login: " + e);
           return res.status(500).send( { status: 500, data: {}, message: e.message });
         }
    }
  }
  /* @Method: login
     @Description: User Login
    */
  async login(req, res) {
    try {
   //   console.log(req.body.email.trim());
      let user = await userRepo.getUserByField({
        email: { $regex: "^" + req.body.email.trim() + "$", $options: "i" },
        isDeleted: false,
        status: "Active"
      });
      let decrypted = await decryptString(req.body.password);
      if (!_.isEmpty(user)) {
        if (!user.validPassword(decrypted, user.password)) {
          res.status(201).send( { status: 201, data: {}, message: "Password not matched." });
        } else {
          const payload = { id: user._id };
          const token = jwt.sign(payload, config.jwtSecret, {
            expiresIn: parseInt(process.env.LOGIN_SESSION_TOKEN_EXPIRY),//86400,
          });
          var datetime = new Date();
          var query = {
            last_login: datetime,
          };
          await userRepo.updateById(query, user._id);
          // console.log(JSON.stringify(user, null, 4));
          let usr = await filterUserDetailed(user)
          res.status(200).send( { status: 200, data: usr, token: token, message: "Logged in successfully." });
        }
      } else {
        res.status(201).send( { status: 201, data: {}, message: "User not found." });
      }
    } catch (e) {
      console.log("Error login: " + e);
      res.status(500).send( { status: 500, data: {}, message: e.message });
    }
  }
    /* @Method: AddUser
    @Description: User Add
    */
  async addUser(req, res) {
    try {

      if (!_.isEmpty(req.body.role)) {
        let role = await roleRepo.getByField({ role: req.body.role });
        req.body.role = role._id;
      } else {
        res.status(201).send( { status: 201, data: [], message: "Role is empty." });
      }

      //user email available checking
      if (!_.isEmpty(req.body.email)) {
        let checkEmail = await userRepo.getByField({
          email: req.body.email,
          isDeleted: false
        });
        if (!_.isEmpty(checkEmail)) {
          res.status(201).send( { status: 201, data: [], message: "Email already exists." });
        } else {
          req.body.email = req.body.email;
        }
      }

      let datetime = new Date();
      req.body.last_login = datetime;
      req.body.password_updatedAt = datetime;

      let random_pass = Math.random().toString(36).substr(2, 8);
      const readable_pass = random_pass;

      random_pass = User.generateHash(random_pass);

      req.body.email = req.body.email.toLowerCase();
      req.body.full_name = `${req.body.first_name} ${req.body.last_name}`;
      req.body.login_name = req.body.email.toLowerCase();

      let locals = {
        user: req.body.full_name,
        password: readable_pass,
       // isadmin: req.body.is_admin,
        login_url: process.env.LOGIN_URL,
      };

      let isMailSend = await mailer.sendMail(
        `V-Assure<${process.env.MAIL_USERNAME}>`,
        req.body.email,
        "User Registration",
        "user-add-password",
        locals
      );

      req.body.password = random_pass;

      let userData = await userRepo.save(req.body);
      let usr = await filterUser(userData);
      if (!_.isEmpty(usr)) {
        res.status(200).send( {status: 200, data: usr, message: "User added successfully!" });
      } else {
        res.status(201).send( { status: 201, data: {}, message: "Somethig went wrong!" });
      }
    } catch (e) {
      console.log("Error in addUser: " + e);
      res.status(500).send({ status: 500, message: e.message });
    }
  }

  async updateUser(req, res) {
    try {
      let userID = new mongoose.Types.ObjectId(req.params.id);
   //   var userData = await userRepo.getById(logged_in_user);

      //Update Email

      if (!_.isEmpty(req.body.role) && req.body.role != "") {
        let role = await roleRepo.getByField({ role: req.body.role });
        req.body.role = role._id;
      } 

      if (req.body.email && req.body.email != "") {
        var emailExists = await userRepo.getByField({
          email: req.body.email,
          // role: req.body.role,
          isDeleted: false,
          _id: { $ne: new mongoose.Types.ObjectId(userID) }
        });

        if (!_.isEmpty(emailExists) && !_.isNull(emailExists)) {
          res.status(201).send( {status: 201, data: {}, message: "This email address is in use. Please try with another email address."});
        }
      }

      var userProfileUpdate = await userRepo.updateById(
        req.body,
        userID
      );
     
     req.body.userUpdate = true;
     let usr = await userRepo.getAllUsers(req);

      if (!_.isEmpty(userProfileUpdate) && !_.isNull(userProfileUpdate)) {
        res.status(200).send( { status: 200, updateData: userProfileUpdate, inPageData: usr, message: "User updated successfully." });
      } else {
        res.status(201).send( { status: 201, data: {}, message: "We are unable to update the profile, Please try again." });
      }
    } catch (error) {
      console.log("Error updateUser: " + error);
      res.status(500).send( { status: 500, data: {}, message: error.message });
    }
  }

  /* @Method: deleteUser
  @Description: User Delete
  */
  async deleteUser(req, res) {
    try {
      let DeleteUser = await userRepo.updateById(
        {
          isDeleted: true,
          status: "Inactive"
        },
        new mongoose.Types.ObjectId(req.body.id)
      );

      let userDetail = await userRepo.getAllUsers(req);

      if (!_.isEmpty(DeleteUser) && !_.isNull(DeleteUser)) {
        res.status(200).send( { status: 200, data: userDetail,  message: "User deleted successfully." });
      } else {
        res.status(201).send( { status: 201, data: {}, message: "Unable to find The user." });
      }
    } catch (error) {
      console.log("Error deleteUser: " + error);
      res.status(500).send( { status: 500, data: {}, message: error.message });
    }
  }

  /* @Method: getAllUserPagi
  @Description: User All
  */
  async getAllUserPagi(req, res) {
    try {
      let userDetail = await userRepo.getAllUsers(req);
  //    console.log(JSON.stringify(userDetail, null, 4));
      if (!_.isEmpty(userDetail) && !_.isNull(userDetail)) {
        res.status(200).send( { status: 200, data: userDetail, message: "User Data Retrive Success." });
      } else {
        res.status(201).send( { status: 201, data: {},  message: "We are unable to Find Users." });
      }
    } catch (error) {
      console.log("getAllUserPagi function Error: " + e);
      res.status(500).send( { status: 500, data: {}, message: error.message });
    }
  }

  /* @Method: getAllUser
    @Description: User All
    */
  async getAllUser(req, res) {
    try {
      let userDetail = await userRepo.getAllByField({
        isDeleted: false
      });

      if (!_.isEmpty(userDetail) && !_.isNull(userDetail)) {
        res.status(200).send( { status: 200, data: userDetail, message: "User Data Retrive Success." });
      } else {
        res.status(201).send( { status: 201, data: {}, message: "We are unable to Find Users." });
      }
    } catch (error) {
      res.status(201).send( { status: 201, data: {}, message: error.message });
    }
  }

  async getAllByOrg(req, res) {
    try {
      let userDetail = await userRepo.getAllUsers(req);

      if (!_.isEmpty(userDetail) && !_.isNull(userDetail)) {
        res.status(200).send( { status: 200, data: userDetail, message: "User By Organization Retrive Success."  });
      } else {
        res.status(201).send( { status: 201, data: {}, message: "We are unable to Find Organization." });
      }
    } catch (error) {
      res.status(201).send( { status: 201, data: {}, message: error.message });
    }
  }

  async getAllByPro(req, res) {
    try {
      let userDetail = await userRepo.getAllUsers(req);

      if (!_.isEmpty(userDetail) && !_.isNull(userDetail)) {
        res.status(200).send( { status: 200, data: userDetail, message: "User By Project Retrive Success." });
      } else {
        res.status(201).send( { status: 201, data: {}, message: "We are unable to Find Organization." });
      }
    } catch (error) {
      res.status(201).send( { status: 201, data: {}, message: error.message });
    }
  }

  /* @Method: getUserOrg
     @Description: User Organization
    */
  async getUserOrgPro(req, res) {
    try {
      let userDetail = await userRepo.getUserOrgPro({  _id: new mongoose.Types.ObjectId(req.params.id)
      });
      if (!_.isEmpty(userDetail) && !_.isNull(userDetail)) {
        res.status(200).send( { status: 200, data: userDetail, message: "User Organization Retrive Success.", });
      } else {
        res.status(201).send( { status: 201, data: {}, message: "We are unable to Find Organization." });
      }
    } catch (error) {
      res.status(201).send( { status: 201, data: {}, message: error.message });
    }
  }

  /* @Method: resetPassword
   // @Description: To resetPassword
   */
  async resetPassword(req, res) {
    try {
      //validateToken
      let response = await validateIDToken(req.body.id, req.body.token);

      if (response.status == 200) {
        //validate password and confirm Password
        if (req.body.password == req.body.confirmPassword) {
          let passwd = await decryptString(req.body.password);
          let newPassword = User.generateHash(passwd);
          let datetime = new Date();
          let updatedUser = await userRepo.updateById(
            {
              password: newPassword,
              password_updatedAt: datetime,
            },
            req.body.id
          );
          if (updatedUser) {
            res.status(200).send( { status: 200, data: {}, message: "Password reset successful." });
          } else {
            res.status(201).send( { status: 201, message: "Something went wrong.." });
          }
        } else {
          res.status(201).send( { status: 201, data: {}, message: "Password and confirm password mismatch." });
        }
      }else{
        res.status(response.status).send( response);
      }
    } catch (error) {
      console.log("Error in resetPassword: " + error);
      res.status(500).send( { status: 500, message: error.message });
    }
  }

  /* @Method: validateToken
   // @Description: To validateToken
   */
  async validateToken(req, res) {
    try {
      let response = await validateIDToken(req.body.id, req.body.token);
      res.status(response.status).send( response);
    } catch (error) {
      console.log("Error in validateToken: " + error);
      res.status(500).send( { status: 500, message: error.message });
    }
  }

  /* @Method: forgotPassword
   // @Description: To forgotPassword
   */
  async forgotPassword(req, res) {
    try {
      let user = await userRepo.forgotPassword({
        email: req.body.email.toLowerCase(),
        isDeleted: false,
        status: "Active"
      });

      if (user) {
        const secret = config.jwtSecret + user.password;
        let paylod = {
          email: user.email,
          id: user._id,
        };
        let token = jwt.sign(paylod, secret, {
          expiresIn: parseInt(process.env.PASSWORD_RESET_TOKEN_EXPIRY),
        });
        let link = `${process.env.LOGIN_URL}/reset-password/${user._id}/${token}`;
        let locals = {
          user: user.full_name,
          link: link,
          expiry:
            Math.round((parseInt(process.env.PASSWORD_RESET_TOKEN_EXPIRY) / 60 / 60) * 100) /
            100,
        };
        let isMailSend = await mailer.sendMail(
          `V-Assure<${process.env.MAIL_USERNAME}>`,
          req.body.email,
          "Reset Password",
          "forgot-password",
          locals
        );
        res.status(200).send( { status: 200, data: {}, message: "Reset password link has been sent to your email address." });
      } else {
        res.status(201).send( { status: 201, data: {}, message: "No user found." });
      }
    } catch (e) {
      console.log("Error in forgotPassword: " + e);
      res.status(500).send( { status: 500, message: e.message });
    }
  }

  /**
   *Change Password
   */
  async changePassword(req, res) {
    try {
      let userData = await userRepo.getUser(req.body.userId);
      //console.log("req.user._id :"+ req.user._id);
      //console.log(JSON.stringify(userData, null, 4));

      if (!_.isEmpty(userData) && userData.isDeleted == false && userData.status == "Active") {
        try {
          let decrypted = await decryptString(req.body.password);
          if (User.validPassword(decrypted, userData.password)) {
            res.status(201).send( {
              status: 201,
              data: [],
              message: "You have entered an Old Password.",
            });
          } else {
            let newPassword = User.generateHash(decrypted);
            let datetime = new Date();
            let updatedUser = await userRepo.updateById(
              {
                password: newPassword,
                password_updatedAt: datetime,
              },
              userData._id
            );
            if (updatedUser) {
              res.status(200).send( {
                status: 200,
                data: {},
                message: "Password changed successfully.",
              });
            }
          }
        } catch (error) {
          console.log(error);
          res.status(500).send({ status: 500, message: error.message });
        }
      } else {
        res.status(201).send( { status: 201, data: [], message: "User not Active." });
      }
    } catch (e) {
      res.status(201).send( { status: 500, message: e.message });
    }
  }

  // We are using two api one is for login and another getProfile. combine these two.
  // async getProfile(req, res) {
  //   try {
  //     let logged_in_user = req.user._id;
  //     let userDetail = await userRepo.getUserById(logged_in_user);
  //     let usr = await filterUserDetailed(userDetail);
  //     if (!_.isEmpty(usr) && !_.isNull(usr)) {
  //       res.status(201).send( {
  //         status: 200,
  //         data: usr,
  //         message: "Profile fetched successfully.",
  //       };
  //     } else {
  //       res.status(201).send( {
  //         status: 201,
  //         data: {},
  //         message: "We are unable to fetch the profile details at this moment.",
  //       };
  //     }
  //   } catch (error) {
  //     console.log(error);
  //     res.status(201).send( { status: 201, data: {}, message: error.message };
  //   }
  // }

  async details(req, res) {
    try {
      let logged_in_user = req.params.id;

      let userDetail = await userRepo.getUserById(logged_in_user);
      let usr = await filterUserDetailed(userDetail);
      if (!_.isEmpty(usr) && !_.isNull(usr)) {
        res.status(200).send( {
          status: 200,
          data: usr,
          message: "Data fetched successfully.",
        });
      } else {
        res.status(201).send( {
          status: 201,
          data: {},
          message: "We are unable to fetch the User details at this moment.",
        });
      }
    } catch (error) {
      console.log(error);
      res.status(201).send( { status: 201, data: {}, message: error.message });
    }
  }
}

async function validateIDToken(id, token) {
  try {
    let user = await userRepo.getUserById(new mongoose.Types.ObjectId(id));
    if (user) {
      let secret = config.jwtSecret + user.password;
      let payload = jwt.verify(token, secret);
      return { status: 200, data: { user_name: user.full_name }, message: "" };
    } else {
      return { status: 201, data: {}, message: "Not a valid URL." };
    }
  } catch (e) {
    console.log("Error in validateIDToken : " + e);
    //invalid signature -- for password already changed.
    //invalid token  -- token got tampered
    //jwt expired -- token expired
    if (e.message == "jwt expired")
      return { status: 201, message: "URL expired." };
    else 
      return { status: 201, message: "Not a valid URL." };
  }
}

async function decryptString(str){
  let decrypted =  CryptoJS.AES.decrypt(str, CryptoJS.enc.Utf8.parse(process.env.LOGIN_SECRET_KEY), {mode:CryptoJS.mode.ECB});
  return decrypted.toString(CryptoJS.enc.Utf8);
}

async function filterUser(user) {
  return {
    _id: user._id,
    first_name: user.first_name,
    last_name: user.last_name,
    email: user.email,
    org_code: user.org_code,
    role: user.role,
    // userRole: {
    //   _id: user.role._id,
    //   roleDisplayName:  user.role.roleDisplayName,
    //   role: user.role.role,
    //   desc: user.role.desc
    // },
    // is_admin: user.is_admin,
    notification_preference: user.notification_preference,
    status: user.status,
    isDeleted: user.isDeleted
  };
}

async function filterUserDetailed(user) {
  return {
    _id: user._id,
    first_name: user.first_name,
    last_name: user.last_name,
    email: user.email,
    org_code: {
      _id: user.org_code._id,
      org_name: user.org_code.org_name,
      country: user.org_code.country,
      enabledFn:user.org_code.enabledFn,
      isDeleted: user.org_code.isDeleted
    },
    userRole: {
      _id: user.role._id,
      roleDisplayName:  user.role.roleDisplayName,
      role: user.role.role,
      desc: user.role.desc
    },
    //is_admin: user.is_admin,
    time_interval : user.org_code.api_frequency,
    notification_preference: user.notification_preference,
    isDeleted: user.isDeleted,
    status: user.status,
    project_code:user.project_code,
    userType: user.security_profile
  };
}

module.exports = new UserController();
