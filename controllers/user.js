const _ = require('lodash');
const async = require('async');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const passport = require('passport');
const User = require('../models/User');
const Thread = require('../models/Thread');
const Review = require('../models/Review');
const Enums = require('../models/Enums');
const Transaction = require('../models/Transaction');
const activities = require('../config/activities');
const fs = require('fs');
const aws = require('aws-sdk');
const helpers = require('./helpers');
const moment = require('moment');
const app = require('../app');

/**
 * GET /login
 * Login page.
 */
exports.getLogin = (req, res) => {
  if (req.user) {
    return res.redirect('/');
  }
  res.render('account/login', {
    title: 'Login'
  });
};

/**
 * POST /login
 * Sign in using email and password.
 */
exports.postLogin = (req, res, next) => {
  req.assert('email', 'Email is not valid').isEmail();
  req.assert('password', 'Password cannot be blank').notEmpty();
  req.sanitize('email').normalizeEmail({ remove_dots: false });

  const errors = req.validationErrors();

  if (errors) {
    req.flash('errors', errors);
    return res.redirect('/login');
  }

  passport.authenticate('local', (err, user, info) => {
    if (err) { return next(err); }
    if (!user) {
      req.flash('errors', info);
      return res.redirect('/login');
    }
    req.logIn(user, (err) => {
      if (err) { return next(err); }
      req.flash('success', { msg: 'Success! You are logged in.' });
      res.redirect(req.session.returnTo || '/');
    });
  })(req, res, next);
};

/**
 * GET /logout
 * Log out.
 */
exports.logout = (req, res) => {
  req.logout();
  res.redirect('/');
};

/**
 * GET /signup
 * Signup page.
 */
exports.getSignup = (req, res) => {
  if (req.user) {
    return res.redirect('/');
  }
  res.render('account/signup', {
    title: 'Create Account'
  });
};

exports.postSignupWeb = (req, res, next) => {
  doSignup(req, next, (errors) => {
      req.flash('errors', errors);
      return res.redirect('/signup');
  });
};

exports.postSignupApi = (req, res, next) => {
  doSignup(req, next, (errors) => {
      return res.status(400).json({
          error: errors,
          token: null,
          status: 400,
      });
  });
};

/**
 * POST /signup
 * Create a new local account.
 */
function doSignup (req, next, validation_callback) {
  req.assert('first_name', 'You need to provide a first name').notEmpty();
  req.assert('last_name', 'You need to provide a last name').notEmpty();
  req.assert('email', 'Email is not valid').isEmail();
  req.assert('password', 'Password must be at least 4 characters long').notEmpty().len(4);
  req.assert('confirmPassword', 'Passwords do not match').equals(req.body.password);
  req.sanitize('email').normalizeEmail({ remove_dots: false });

  const errors = req.validationErrors();

  if (errors) {
    return validation_callback(errors);
  }

  var protocol = req.secure ? 'https://' : 'http://';
  var base_url = protocol + req.headers.host;
  const user = new User({
    profile: {
      name: req.body.first_name + ' ' + req.body.last_name,
      picture: base_url + '/images/person_placeholder.gif',
    },
    email: req.body.email,
    password: req.body.password
  });

  User.findOne({ email: req.body.email }, (err, existingUser) => {
    if (existingUser) {
      return validation_callback({ msg: 'Account with that email address already exists.' });
    }
    async.waterfall([
      function (callback) {
        user.save(function (err) {
          sendWelcomeEmail(user, req, function () {});
          callback(err, user);
        });
      },
      function (user, callback) {
        req.logIn(user, function (err) {
          callback(err);
        });
      }
    ], function (err) {
        if (err) return next(err);
        next();
    });
  });
};

exports.getOnboarding = (req, res) => {
    res.render('account/newaccount', {
        title: 'Welcome',
        activities: activities.activityMap,
    });
};

/**
 * GET /account
 * Profile page.
 */
exports.getAccount = (req, res) => {
  var my_skills = req.user.skills.map(activities.getActivityLabelForName);
  var my_interests = req.user.interests.map(activities.getActivityLabelForName);
  res.render('account/profile', {
    title: 'Account Management',
    activities: activities.activityMap,
    my_skills: my_skills,
    my_interests: my_interests,
  });
};

function uploadPicture (filename, fileBuffer, mimetype, callback) {
    //aws credentials
    aws.config = new aws.Config();
    aws.config.accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    aws.config.secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    aws.config.region = process.env.AWS_REGION;
    var BUCKET_NAME = process.env.AWS_BUCKET_NAME;

    var s3 = new aws.S3();
    s3.putObject({
      ACL: 'public-read',
      Bucket: BUCKET_NAME,
      Key: filename,
      Body: fileBuffer,
      ContentType: mimetype
    }, function (error, response) {
      console.log('uploaded file ' + filename);
      callback(error);
    });
}

/**
 * POST /account/profile
 * Update profile information.
 */
exports.postUpdateProfile = (req, res, next) => {
  User.findById(req.user.id, function(err, user) {
    if (err) return next(err);

    user.email = req.body.email || '';
    user.profile.name = req.body.name || '';
    user.profile.gender = req.body.gender || '';
    user.profile.status = req.body.status || '';
    user.profile.location = req.body.location || '';
    user.profile.hometown = req.body.hometown || '';
    user.aboutMe = req.body.aboutme || '';
    user.interests = JSON.parse(req.body.interests) || [];
    user.skills = JSON.parse(req.body.skills) || [];

    async.waterfall([
      function (callback) {
        // If there is a file, upload it to AWS
        if (req.file) {
          var mimetype = req.file.mimetype;
          var filename = req.user._id + '.' + mimetype.split('/').pop();
          user.profile.picture = 'https://s3.' + process.env.AWS_REGION + '.' + 'amazonaws.com/' + process.env.AWS_BUCKET_NAME + '/' + filename;
          uploadPicture(filename, req.file.buffer, mimetype, callback);
        } else {
          callback(null);
        }
      },
      function (callback) {
        user.save(callback);
      },
    ], function (err) {
        if (err) {
          if (err.code === 11000) {
            req.flash('errors', { msg: 'The email address you have entered is already associated with an account.' });
            return res.redirect('/account');
          }
          return next(err);
        }
        req.flash('success', { msg: 'Profile information has been updated.' });
        res.redirect('/account');
    });
  });
};

/**
 * POST /account/password
 * Update current password.
 */
exports.postUpdatePassword = (req, res, next) => {
  req.assert('password', 'Password must be at least 4 characters long').len(4);
  req.assert('confirmPassword', 'Passwords do not match').equals(req.body.password);

  const errors = req.validationErrors();

  if (errors) {
    req.flash('errors', errors);
    return res.redirect('/account');
  }

  User.findById(req.user.id, (err, user) => {
    if (err) { return next(err); }
    user.password = req.body.password;
    user.save((err) => {
      if (err) { return next(err); }
      req.flash('success', { msg: 'Password has been changed.' });
      res.redirect('/account');
    });
  });
};

/**
 * POST /account/delete
 * Delete user account.
 */
exports.postDeleteAccount = (req, res, next) => {
  User.remove({ _id: req.user.id }, (err) => {
    if (err) { return next(err); }
    req.logout();
    req.flash('info', { msg: 'Your account has been deleted.' });
    res.redirect('/');
  });
};

/**
 * GET /account/unlink/:provider
 * Unlink OAuth provider.
 */
exports.getOauthUnlink = (req, res, next) => {
  const provider = req.params.provider;
  User.findById(req.user.id, (err, user) => {
    if (err) { return next(err); }
    user[provider] = undefined;
    user.tokens = user.tokens.filter(token => token.kind !== provider);
    user.save((err) => {
      if (err) { return next(err); }
      req.flash('info', { msg: `${provider} account has been unlinked.` });
      res.redirect('/account');
    });
  });
};

/**
 * GET /reset/:token
 * Reset Password page.
 */
exports.getReset = (req, res, next) => {
  if (req.isAuthenticated()) {
    return res.redirect('/');
  }
  User
    .findOne({ passwordResetToken: req.params.token })
    .where('passwordResetExpires').gt(Date.now())
    .exec((err, user) => {
      if (err) { return next(err); }
      if (!user) {
        req.flash('errors', { msg: 'Password reset token is invalid or has expired.' });
        return res.redirect('/forgot');
      }
      res.render('account/reset', {
        title: 'Password Reset'
      });
    });
};

/**
 * POST /reset/:token
 * Process the reset password request.
 */
exports.postReset = (req, res, next) => {
  req.assert('password', 'Password must be at least 4 characters long.').len(4);
  req.assert('confirm', 'Passwords must match.').equals(req.body.password);

  const errors = req.validationErrors();

  if (errors) {
    req.flash('errors', errors);
    return res.redirect('back');
  }

  async.waterfall([
    function (done) {
      User
        .findOne({ passwordResetToken: req.params.token })
        .where('passwordResetExpires').gt(Date.now())
        .exec((err, user) => {
          if (err) { return next(err); }
          if (!user) {
            req.flash('errors', { msg: 'Password reset token is invalid or has expired.' });
            return res.redirect('back');
          }
          user.password = req.body.password;
          user.passwordResetToken = undefined;
          user.passwordResetExpires = undefined;
          user.save((err) => {
            if (err) { return next(err); }
            req.logIn(user, (err) => {
              done(err, user);
            });
          });
        });
    },
    function (user, done) {
      const transporter = nodemailer.createTransport({
        service: 'Mailgun',
        auth: {
          user: process.env.MAILGUN_USER,
          pass: process.env.MAILGUN_PASSWORD,
        }
      });
      const mailOptions = {
        to: user.email,
        from: 'Bazaar Team <team@shareonbazaar.eu>',
        subject: 'Your Bazaar password has been changed',
        text: `Hello,\n\nThis is a confirmation that the password for your account ${user.email} has just been changed.\n`
      };
      transporter.sendMail(mailOptions, (err) => {
        req.flash('success', { msg: 'Success! Your password has been changed.' });
        done(err);
      });
    }
  ], (err) => {
    if (err) { return next(err); }
    res.redirect('/');
  });
};

/**
 * GET /forgot
 * Forgot Password page.
 */
exports.getForgot = (req, res) => {
  if (req.isAuthenticated()) {
    return res.redirect('/');
  }
  res.render('account/forgot', {
    title: 'Forgot Password'
  });
};

/**
 * POST /forgot
 * Create a random token, then the send user an email with a reset link.
 */
exports.postForgot = (req, res, next) => {
  req.assert('email', 'Please enter a valid email address.').isEmail();
  req.sanitize('email').normalizeEmail({ remove_dots: false });

  const errors = req.validationErrors();

  if (errors) {
    req.flash('errors', errors);
    return res.redirect('/forgot');
  }

  async.waterfall([
    function (done) {
      crypto.randomBytes(16, (err, buf) => {
        const token = buf.toString('hex');
        done(err, token);
      });
    },
    function (token, done) {
      User.findOne({ email: req.body.email }, (err, user) => {
        if (!user) {
          req.flash('errors', { msg: 'Account with that email address does not exist.' });
          return res.redirect('/forgot');
        }
        user.passwordResetToken = token;
        user.passwordResetExpires = Date.now() + 3600000; // 1 hour
        user.save((err) => {
          done(err, token, user);
        });
      });
    },
    function (token, user, done) {
      const transporter = nodemailer.createTransport({
        service: 'Mailgun',
        auth: {
          user: process.env.MAILGUN_USER,
          pass: process.env.MAILGUN_PASSWORD
        }
      });
      const mailOptions = {
        to: user.email,
        from: 'Bazaar Team <team@shareonbazaar.eu>',
        subject: 'Reset your password on Bazaar',
        text: `You are receiving this email because you (or someone else) have requested the reset of the password for your account.\n\n
          Please click on the following link, or paste this into your browser to complete the process:\n\n
          http://${req.headers.host}/reset/${token}\n\n
          If you did not request this, please ignore this email and your password will remain unchanged.\n`
      };
      transporter.sendMail(mailOptions, (err) => {
        req.flash('info', { msg: `An e-mail has been sent to ${user.email} with further instructions.` });
        done(err);
      });
    }
  ], (err) => {
    if (err) { return next(err); }
    res.redirect('/forgot');
  });
};

/* Takes in two arrays. Returns the number of elements
   they have in common
*/
function numElementsInCommon (arr1, arr2) {
    return arr1.filter(function (elem) {
        return arr2.indexOf(elem) >= 0;
    }).length;
}

/**
 * GET /users
 * If user is a refugee, show native users and vice versa.
 */
exports.getCommunity = (req, res) => {
  var my_interests = req.user.interests;
  var my_skills = req.user.skills;
  var my_status = req.user.profile.status || 'native';

  User.find({ 'profile.status': {$ne: my_status }}, (err, results) => {
    results.sort((a, b) => {
        var a_score = numElementsInCommon(a.interests, my_skills) + numElementsInCommon(a.skills, my_interests);
        var b_score = numElementsInCommon(b.interests, my_skills) + numElementsInCommon(b.skills, my_interests);
        return b_score - a_score;
    }).forEach((user) => {
        var interests_match = numElementsInCommon(user.skills, my_interests);
        var skills_match = numElementsInCommon(user.interests, my_skills);
        if ((interests_match + skills_match) > 5) {
            user.match = 'both';
        } else if (interests_match > 0 || skills_match > 0) {
            user.match = 'one';
        } else {
            user.match = 'none';
        }

        postSearchProcessing(user, req);
    })
    res.render('users/showall', {
        title: 'Community',
        users: results,
        current_user_interests: activities.populateLabels(my_interests),
        RequestType: Enums.RequestType,
    });
  });
};

const EARTH_RADIUS_KM = 6378.1;
function performQuery (req, query, callback) {
  // Default match is an EXCHANGE match - that is, user is interested
  // in both receiving and providing the service.
  if (!(query.skills instanceof Array)) {
      callback({
        error: "'skills' parameter is required and must be an array of skills",
      });
      return;
  }

  var db_query = {
      skills: {'$in': query.skills},
      interests: {'$in': query.skills},
      _id: {'$ne': req.user.id},
  };
  var error;

  if (query.request_type === Enums.RequestType.LEARN) {
      delete db_query['interests'];
  } else if (query.request_type === Enums.RequestType.SHARE) {
      delete db_query['skills'];
  }

  var distance = query.distance;
  var longitude = query.longitude;
  var latitude = query.latitude;

  // undefined will always get pushed to the end of the array, so this checks
  // that there is a defined value _and_ at least one undefined value.
  if ([distance, longitude, latitude].sort().indexOf(undefined) > 0) {
      error = {error: 'Distance, latitude, and longitude must all be specified together (or not at all).'};
      callback(error);
      return;
  }

  if (distance && longitude && latitude) {
      if (isNaN(distance) || distance <= 0) {
          error = {error: 'Distance must be a positive number'};
      }
      if (isNaN(longitude) || isNaN(latitude)) {
          error = {error: 'Latitude and longitude must be numbers'};
      }
      if (error) {
          callback(error);
          return;
      }
      db_query.loc = {
          '$geoWithin': {'$centerSphere': [ [Number(longitude), Number(latitude)], Number(distance) / EARTH_RADIUS_KM ] },
      }
  }

  User.find(db_query, callback);
}

function postSearchProcessing (user, req) {
    // Populate skills to include human-readable label
    user.skills = activities.populateLabels(user.skills);

}

exports.search = (req, res) => {
  var query = req.query;
  query.longitude = req.user.loc.coordinates[0];
  query.latitude = req.user.loc.coordinates[1];
  return performQuery(req, query, (err, results) => {
      async.map(results, (item, cb) => {
        postSearchProcessing(item, req);
        res.app.render('partials/userCard', {
          layout: false,
          card_user: item,
        }, cb);
      }, (err, response) => {
        res.json(response);
      });
  });
}

exports.surprise = (req, res) => {
    User.findOne({'$or': [
      {skills: {'$in': req.user.interests}},
      {interests: {'$in': req.user.skills}}
      ]}, (err, ideal_match) => {
        if (ideal_match) {
            return res.redirect('/profile/' + ideal_match._id);
        }
        User.findOne({_id: {$ne: req.user.id}}, (err, any_match) => {
            if (!any_match) {
                return res.redirect('/');
            }
            return res.redirect('/profile/' + any_match._id);
        });
    });
}

/**
 * GET /list
 * List all users whose name matches the query term. Used for searching
 */
exports.list = function(req, res) {
  var regex = new RegExp(req.query.term.replace(/\\/g, ''), 'i');
  User.find({
    'profile.name': {$regex: regex},
    _id: {$ne: req.user.id},
  }, function (err, results) {
    data = results.map(function (user) {
        return {
          label: user.profile.name,
          value: {id: user._id, pic: user.profile.picture},
        };
    });
    res.json(data);
  });
};

/**
 * GET /profile/:id
 * Show profile for a given user, specified by :id
 */
exports.showProfile = function(req, res) {
    User.findById(req.params.id, function (err, user) {
        if (!user) {
            res.status(404).render('error/404', {
                title: 'Error 404',
                status: 404,
                url: req.url,
            });
            return;
        }
        user.skills = activities.populateLabels(user.skills);
        user.interests = activities.populateLabels(user.interests);

        // This is kind of gross, that we need two queries just to get reviews
        // for a user. Other option is to change schema to make reviews an
        // embedded document of transactions.
        Transaction.find({'_participants': user._id}, function (err, transactions) {
            var t_ids = transactions.map((t) => t._id);
            Review.find({'$and': [{'_transaction': {'$in': t_ids}}, { '_creator': {'$ne': req.user.id} }]})
            .populate('_creator')
            .populate('_transaction')
            .exec((err, reviews) => {
                reviews.map((r) => r._transaction)
                       .filter((t, pos, self) => self.indexOf(t) == pos)
                       .forEach((t) => t.service = activities.getActivityLabelForName(t.service));

                res.render('users/profile', {
                    title: user.profile.name,
                    spotlight_user: user,
                    reviews: reviews,
                    RequestType: Enums.RequestType,
                    moment: moment,
                });
            });
        });
    });
};

/**
 * POST /newaccount
 * Post data for a new user account
 */
exports.newAccount = function (req, res) {
    User.findById(req.user.id, function (err, user) {
        user.interests = JSON.parse(req.body.interests) || [];
        user.skills = JSON.parse(req.body.skills) || [];
        user.profile.status = req.body.status;
        user.save(function (err) {
            res.redirect('/');
        });
    });
}

/**
 * POST /location
 * Post location data for a user
 */
exports.postLocation = (req, res) => {
    User.findById(req.user.id, function (err, user) {
        user.loc = {
            type: 'Point',
            coordinates: [Number(req.body.longitude), Number(req.body.latitude)],
        };
        user.save(helpers.respondToAjax(res));
    });
}

/**
 * POST /bookmark/:id
 * Bookmark the profile of another user for the current user, or
 * unbookmark if it is already bookmarked.
 */
exports.postBookmark = (req, res) => {
    var index = req.user.bookmarks.indexOf(req.params.id);
    if (index < 0) {
        req.user.bookmarks.push(req.params.id);
    } else {
        req.user.bookmarks.splice(index, 1);
    }
    req.user.save(helpers.respondToAjax(res));
}

/**
 * GET /bookmarks
 * Show all bookmarks for current user
 */
exports.getBookmarks = (req, res) => {
    var my_interests = req.user.interests;
    User.find({'_id': {'$in': req.user.bookmarks}}, (err, users) => {
        users.forEach((user) => {
            postSearchProcessing(user, req);
        });

        res.render('users/bookmarks', {
            title: 'Bookmarks',
            users: users,
            RequestType: Enums.RequestType,
        });
    });
}

function sendWelcomeEmail (user, req, callback) {
    var transporter = nodemailer.createTransport({
        service: 'Mailgun',
        auth: {
            user: process.env.MAILGUN_USER,
            pass: process.env.MAILGUN_PASSWORD,
        },
    });

    app.render('emailTemplates/welcome', {
        layout: false,
        recipient: user,
        base_url: (req.secure ? 'https://' : 'http://') + req.headers.host,
    }, (err, html_content) => {
          var mailOptions = {
              to: user.email,
              from: 'Bazaar Team <team@shareonbazaar.eu>',
              subject: 'Welcome to the Bazaar, ' + user.profile.name,
              text: 'Hi ' + user.profile.name + ',\n\n' +
                'Thanks for signing up to Bazaar!.\n',
              html: html_content,
          };
          transporter.sendMail(mailOptions, (err) => {
              callback(err);
          });
    });
}

/**
 * Send welcome email to a user after registration
 */
exports.sendWelcomeEmail = sendWelcomeEmail;

function getPublicUserData (user) {
    return {
        name: user.profile.name,
        _id: user._id,
        picture: user.profile.picture,
        hometown: user.profile.hometown,
        location: user.profile.location,
        status: user.profile.status,
        gender: user.profile.gender,
        coins: user.coins,
        skills: activities.populateLabels(user.skills),
        interests: activities.populateLabels(user.interests),
        aboutMe: user.aboutMe,
    }
};

exports.apiSearchUsers = function (req, res) {
  if (Object.keys(req.query).length === 0) {
      User.find({_id: {'$ne': req.user.id}}, (err, results) => {
          res.json(results.map(getPublicUserData));
      });
  } else {
      // FIXME: Use IP address to get long/lat?
      performQuery(req, req.query, (err, results) => {
          if (err) {
            res.status(400).json(err);
          } else {
            res.json(results.map(getPublicUserData));
          }
      });
  }
};
