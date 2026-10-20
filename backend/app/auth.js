const passport = require("passport");
const passportJWT = require("passport-jwt");
const users = require('user/models/user.model');
const AuthProfile = require('auth_profile/models/auth_profile.model');
const cfg = require("./config.js");
const ExtractJwt = passportJWT.ExtractJwt;

const JwtStrategy = passportJWT.Strategy;
//const { MultiSamlStrategy } = require('passport-saml');
const { MultiSamlStrategy } = require('@node-saml/passport-saml');

const JWTparams = {
    secretOrKey: cfg.jwtSecret,
    jwtFromRequest: ExtractJwt.fromHeader('token')
};

const samlStrategy = new MultiSamlStrategy(
    { 
    passReqToCallback: true, // makes req available in callback
    getSamlOptions(request, done) {
        fetchSamlConfig(request, function(err, authprofile) {
            //console.log(err+"---MultiSamlStrategy---"+JSON.stringify(authprofile, null, 4))
            if (err) {
              return done(err, null);
            }
            if (authprofile) {
                done(null, authprofile);
            } 
            else {
               return done("Not a valid SSO Request", null);
            }
          });
      }
    },        
    (req, profile, done) => {
       // console.log("MultiSamlStrategy ----"+JSON.stringify(profile, null, 4))
   return  done(null, profile);
    } 
);


const fetchSamlConfig = (request, done) => {
    AuthProfile.findOne({org_code: request.params.id})
        .exec().then((authprofile)=>{
            if (authprofile) {
                done(null, authprofile.configuration);
            } else {
                return done("Not valid Org", null);
            }
        }).catch((err) => {
            return done(err, null);
        });
  };

module.exports = () => {

    // Serialize and deserialize user sessions
    passport.serializeUser((user, done) => {
        done(null, user);
    });
  
     passport.deserializeUser((user, done) => {
        done(null, user);
    });

    passport.use('jwt', new JwtStrategy(JWTparams, (payload, done) => {
        //console.log(" JWT payload...."+payload.id);
        users.findOne({_id: payload.id, status:"Active"})
        .populate("role")
        .populate("org_code")
        .select(
            " first_name last_name email org_code role notification_preference isDeleted status "
          ).exec()
          .then (user => {
            if (user)
                done(null, user);
            else
                done(null, false);
            })
         .catch(err => {
            return done(err, false);
        });
    }));

    passport.use('saml', samlStrategy);

    return {
        session: () =>{
            return passport.session();
        },
        initialize: () => {
            return passport.initialize();
        },
        authenticateSamlCallback: passport.authenticate('saml', {failureRedirect: '/', failureFlash: true } ), 
         
        authenticateSaml:  (req, res, next) => {
		//console.log("Inside authenticateSaml");
             passport.authenticate('saml', {failureRedirect: '/', failureFlash: true } , (err, user) => {
                //console.log("authenticateSaml : "+err+" User : "+user)
                if (err) {
                    res.status(500).send({
                        status: 500,
                        data : [],
                        message: 'Invalid SSO request.'
                    });
                   return next();
                }else if (!user) {
                   res.status(500).send({
                        status: 500,
                        auth: false,
                        message: "There was a problem finding the user."
                    });
                   return next();
                }else if (user) {
                    req.user = user;
                    //console.log("authenticateSaml req.user: " + JSON.stringify(req.user, null, 4));
                    return next();
                }
            })(req, res, next);
        }, 
        // This is for webservice jwt token check //
        authenticateAPI: (req, res, next) => {
            // check for nonsecure path like login //
            const nonSecurePaths = cfg.nonSecurePaths;
            if (_.contains(nonSecurePaths, req.path)) return next();
            // check for nonsecure path like login //
            passport.authenticate('jwt', cfg.jwtSession, (err, user) => {
               // console.log("authenticateAPI : "+err+" User : "+user)
                if (err) {
                    res.status(401).send( { status: 401, data: {}, message: "Failed to authenticate token." });
                    // res.send({
                    //     status: 500,
                    //     auth: false,
                    //     message: 'Failed to authenticate token.'
                    // });
                }
                if (!user) {
                    res.status(401).send( { status: 401, data: {}, message: "Unauthorized user." });
                }
                if (user) {
                    req.user = user;
                    return next();
                }
            })(req, res, next);
        },
        logout:(req, res, next) => {
          // console.log("user auth.logout : "+JSON.stringify(req.user, null, 4));
           samlStrategy.logout(req, (err, request) =>{
            // res.header('Access-Control-Allow-Origin','*');
             return res.redirect(request);
         });

        //    if (req.user && req.user.nameID ){
        //   //  console.log("user auth.logout : "+JSON.stringify(req.user, null, 4));
        //         samlStrategy.logout(req, (err, request) =>{
        //            // res.header('Access-Control-Allow-Origin','*');
        //             return res.redirect(request);
        //         });
        //     }else{ 
        //       //  console.log("Not a SAMLrequest logout.......")
        //         return res.redirect('/api/user/logoutcallback');
        //     }
        }
    };
};