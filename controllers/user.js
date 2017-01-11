const _ = require('lodash');
const async = require('async');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const passport = require('passport');
const User = require('../models/User');
const Category = require('../models/Category');
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
    Category.find({}).populate('_skills').exec((err, results) => {
        res.render('account/newaccount', {
            title: 'Welcome',
            categories: results,
            locale: 'en',
        });
    });
};

/**
 * GET /account
 * Profile page.
 */
exports.getAccount = (req, res) => {
  Category.find({}).populate('_skills').exec((err, results) => {
      res.render('account/settings', {
        title: 'Account Management',
      });
  })
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
    user._interests = JSON.parse(req.body.interests) || [];
    user._skills = JSON.parse(req.body.skills) || [];

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
        res.redirect('/profile/' + req.user.id);
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
  User.findOneAndUpdate({ _id: req.user.id },
    {
      isDeleted: true,
      // make sure email is still unique but free up the real email in case user wants to sign up again
      email: req.user.id,
      'profile.name': 'Deleted User',
      'profile.picture': '/images/person_placeholder.gif',
      facebook: '',
      google: '',
    }, (err) => {
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
  var my_interests_ids = req.user._interests.map((x) => x._id);
  var my_skills_ids = req.user._skills.map((x) => x._id);
  var my_status = req.user.profile.status || 'native';

  // add a match for not me and not status
  User.aggregate([
    {
      '$match': {
        '_id': {'$ne': helpers.toObjectId(req.user._id)},
        'profile.status': {'$ne': my_status},
        'isDeleted': {'$ne': true},
      },
    },
    {
      '$unwind': {'path': '$_skills', 'preserveNullAndEmptyArrays': true},
    },
    {
      '$lookup': {
          'from': 'skills',
          'localField': '_skills',
          'foreignField': '_id',
          'as': '_skills',
      }
    },
    {
      '$unwind': {'path': '$_skills', 'preserveNullAndEmptyArrays': true},
    },
    {
      '$project': {
        'profile': '$profile',
        '_interests': '$_interests',
        'loc': { '$ifNull': [ "$loc", {'$literal': {type: 'Point', coordinates: [null, null]}}] },
        '_skills': {
          '_id': '$_skills._id',
          'label': '$_skills.label',

          'skill_score': {
            '$cond': {
              'if': { '$eq': [{'$ifNull': ['$_skills', null]}, null] },
              'then': -1,
              'else': {
                '$cond': {
                  'if': { '$setIsSubset': [['$_skills._id'], my_interests_ids] },
                  'then': 1,
                  'else': 0,
                }
              }
            }
          },
        },
        '_skills_ids': '$_skills._id',
      }
    },
    {
      '$sort': {
          '_skills.skill_score': -1,
      }
    },
    {
      '$redact': {
        $cond: {
          if: {
              '$eq': ['$skill_score', -1]
          },
          then: '$$PRUNE',
          else: '$$DESCEND'
        }
      }
    },
    {
      '$group': {
          '_id': '$_id',
          '_skills': {'$push': '$_skills'},
          '_skills_ids': {'$push': '$_skills_ids'},
          '_interests': {'$first': '$_interests'},
          'profile': {'$first': '$profile'},
          'loc': {'$first': '$loc'},
      }
    },
    {
      '$project': {
          '_skills': '$_skills',
          '_interests': '$_interests',
          'profile': '$profile',
          'loc': '$loc',
          'score': {
              '$sum': [
                  {
                      '$size': {
                          '$setIntersection': ['$_skills_ids', my_interests_ids],
                      },
                  },
                  {
                      '$size': {
                          '$setIntersection': ['$_interests', my_skills_ids],
                      },
                  },
              ],
          }
      }
    },
    {
      '$unwind': {'path': '$_interests', 'preserveNullAndEmptyArrays': true},
    },
    {
      '$lookup': {
          'from': 'skills',
          'localField': '_interests',
          'foreignField': '_id',
          'as': '_interests',
      }
    },
    {
      '$unwind': {'path': '$_interests', 'preserveNullAndEmptyArrays': true},
    },
    {
      '$group': {
          '_id': '$_id',
          '_skills': {'$first': '$_skills'},
          '_interests': {'$push': '$_interests'},
          'profile': {'$first': '$profile'},
          'loc': {'$first': '$loc'},
          'score': {'$first': '$score'},
      }
    },
    {
      '$sort': {
          'score': -1,
      },
    },
  ])
  .exec((err, results) => {
      res.render('users/showall', {
          title: 'Community',
          users: results,
          RequestType: Enums.RequestType,
          locale: 'en',
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
      _skills: {'$in': query.skills.map(helpers.toObjectId)},
      _interests: {'$in': query.skills.map(helpers.toObjectId)},
      _id: {'$ne': helpers.toObjectId(req.user._id)},
  };
  var error;

  if (query.request_type === Enums.RequestType.LEARN) {
      delete db_query['_interests'];
  } else if (query.request_type === Enums.RequestType.SHARE) {
      delete db_query['_skills'];
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
  User.find(db_query).populate('_skills _interests').exec(callback);
}

exports.search = (req, res) => {
  var query = req.query;
  query.longitude = req.user.loc.coordinates[0];
  query.latitude = req.user.loc.coordinates[1];
  return performQuery(req, query, (err, results) => {
      if (err)
        return res.json(err);
      async.map(results, (item, cb) => {
        res.app.render('partials/userCard', {
          layout: false,
          card_user: item,
          curr_user: req.user,
          locale: 'en',
        }, cb);
      }, (err, response) => {
        if (err)
          return res.json(err)
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
exports.list = (req, res) => {
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
exports.showProfile = (req, res) => {
    User.findById(req.params.id)
    .populate('_skills _interests')
    .exec((err, user) => {
        if (!user) {
            res.status(404).render('error/404', {
                title: 'Profile not found',
                url: req.url,
            });
            return;
        }

        // This is kind of gross, that we need two queries just to get reviews
        // for a user. Other option is to change schema to make reviews an
        // embedded document of transactions.
        Transaction.find({'_participants': user._id}, (err, transactions) => {
            var t_ids = transactions.map((t) => t._id);
            Review.find({'$and': [{'_transaction': {'$in': t_ids}}, { '_creator': {'$ne': req.user.id} }]})
            .populate('_creator')
            .populate({
              path: '_transaction',
              populate: {
                path: 'service',
              }
            })
            .exec((err, reviews) => {

                // FIXME: Deduplication? But do we need this?
                reviews.map((r) => r._transaction)
                       .filter((t, pos, self) => self.indexOf(t) == pos);

                res.render('users/profile', {
                    title: user.profile.name,
                    spotlight_user: user,
                    reviews: reviews,
                    RequestType: Enums.RequestType,
                    moment: moment,
                    locale: 'en',
                });
            });
        });
    });
};

/**
 * GET /profile/edit
 * Edit one's own profile
 */
exports.editProfile = (req, res) => {
    Category.find({}).populate('_skills').exec((err, results) => {
        res.render('users/edit', {
            title: 'Edit Profile',
            activities: results,
            locale: 'en',
        });
    });
}

/**
 * POST /newaccount
 * Post data for a new user account
 */
exports.newAccount = function (req, res) {
    User.findById(req.user.id, function (err, user) {
        user._interests = JSON.parse(req.body.interests) || [];
        user._skills = JSON.parse(req.body.skills) || [];
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
    User.findById(req.user._id, function (err, user) {
        var index = user.bookmarks.map((x) => x.toString()).indexOf(req.params.id);
        if (index < 0) {
            user.bookmarks.push(req.params.id);
        } else {
            user.bookmarks.splice(index, 1);
        }
        user.save(helpers.respondToAjax(res));
    });
}

/**
 * GET /bookmarks
 * Show all bookmarks for current user
 */
exports.getBookmarks = (req, res) => {
    User.find({'_id': {'$in': req.user.bookmarks}})
    .populate('_skills _interests')
    .exec((err, users) => {
        res.render('users/bookmarks', {
            title: 'Bookmarks',
            users: users,
            RequestType: Enums.RequestType,
            locale: 'en',
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
        skills: user._skills,
        interests: user._interests,
        aboutMe: user.aboutMe,
    }
};

exports.apiSearchUsers = function (req, res) {
  if (Object.keys(req.query).length === 0) {
      User.find({_id: {'$ne': req.user.id}})
      .populate('_skills _interests')
      .exec((err, results) => {
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

exports.apiGetUser = function (req, res) {
    User.findById(req.params.id)
    .populate('_skills _interests')
    .exec((err, user) => {
        if (!user) {
            res.status(404).json(err);
        } else {
            res.json(getPublicUserData(user));
        }
    });
}
