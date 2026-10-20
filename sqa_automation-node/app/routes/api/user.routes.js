const express = require("express");
const router = express.Router();
const userController = require("webservice/user.controller");

/**
 * @api {post} /user/checkUser checking user org belongs to saml/jwt(Default) 
 */
router.post( "/user/checkUser", userController.checkUser );

router.get( "/user/sso/login/:id",  auth.authenticateSaml);

router.post("/user/login/callback/:id", auth.authenticateSamlCallback, (req, res, next) => {
   return res.redirect(process.env.LOGIN_URL+'/login/callback');
});

router.get("/user/isValidUser", userController.SSOLogin)

router.post( "/user/login", userController.login );

router.post(  "/user/resetpassword",  userController.resetPassword);

router.post( "/user/validatetoken", userController.validateToken);

router.post( "/user/forgotpassword", userController.forgotPassword);

router.post( "/user/add", userController.addUser);

router.post( "/user/update/:id", userController.updateUser );

router.post( "/user/delete", userController.deleteUser);

router.post(  "/user/list-pagination", userController.getAllUserPagi);

router.get( "/user/list", userController.getAllUser);

router.get( "/user/organization/project/:id", userController.getUserOrgPro);
      
router.post( "/user/list-by-org", userController.getAllByOrg);

router.post( "/user/list-by-project", userController.getAllByPro);

router.get( "/user/details/:id", userController.details);

// router.get( "api.user.profile.get", "/user/profile/get", userController.getProfile);

router.post( "/user/change-password", userController.changePassword);

router.get("/user/logout/:id", (req, res, next) =>{
 // console.log("user.logout : "+JSON.stringify(req.user, null, 4));
 try{
  if (req.user && req.user.nameID ){
    auth.logout(req, res, next);
  }else{
   // console.log("user logout.....");

    req.logout(() => {
      req.session.destroy((err) => {
        if (err) {
          console.error('Error destroying session:', err);
          return res.status(500).send('Error logging out');
        }
        res.redirect(process.env.LOGIN_URL);
      });
    });
  }
 }catch (error) {
  console.log("api.user.logout Error: "+error);
  res.redirect(process.env.LOGIN_URL);
}

});

router.get('/logoutcallback', (req, res, next) => {
   req.logout(() => {
      req.session.destroy((err) => {
        if (err) {
          console.error('Error destroying session:', err);
          return res.status(500).send('Error logging out');
        }
        res.redirect(process.env.LOGIN_URL);
      });
    });
});

router.post('/logout/callback', (req, res, next) => {
   // console.log("Inside logoutcallback");
   // req.logout(function (err) {
   //    if(err)
   //       console.log("lOGOUT  Error: "+err);
   //    return res.redirect(process.env.LOGIN_URL); 
   // });
   // req.session.destroy(function (err) {
   //    if(err)
   //       console.log("lOGOUT  Error: "+err);
   //    return res.redirect(process.env.LOGIN_URL); 
   //  }); 
   req.logout(() => {
      req.session.destroy((err) => {
        if (err) {
          console.error('Error destroying session:', err);
          return res.status(500).send('Error logging out');
        }
        res.redirect(process.env.LOGIN_URL);
      });
    });

});

// Export the express.Router() instance
module.exports = router;
