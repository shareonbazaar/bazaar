const _ = require('lodash');
const async = require('async');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const passport = require('passport');
const User = require('../models/User');
const Thread = require('../models/Thread');
const Transaction = require('../models/Transaction');
const secrets = require('../config/secrets');
const activities = require('../config/activities');
const fs = require('fs');
const aws = require('aws-sdk');
const helpers = require('./helpers');


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

/**
 * POST /signup
 * Create a new local account.
 */
exports.postSignup = (req, res, next) => {
  req.assert('first_name', 'You need to provide a first name').len(0);
  req.assert('last_name', 'You need to provide a last name').len(0);
  req.assert('email', 'Email is not valid').isEmail();
  req.assert('password', 'Password must be at least 4 characters long').len(4);
  req.assert('confirmPassword', 'Passwords do not match').equals(req.body.password);
  req.sanitize('email').normalizeEmail({ remove_dots: false });

  const errors = req.validationErrors();

  if (errors) {
    req.flash('errors', errors);
    return res.redirect('/signup');
  }

  const user = new User({
    profile: {
      name: req.body.first_name + ' ' + req.body.last_name,
      status: req.body.status,
    },
    email: req.body.email,
    password: req.body.password
  });

  User.findOne({ email: req.body.email }, (err, existingUser) => {
    if (existingUser) {
      req.flash('errors', { msg: 'Account with that email address already exists.' });
      return res.redirect('/signup');
    }

    async.waterfall([
      function (callback) {
        user.save(function (err) {
          callback(err, user);
        });
      },
      function (user, callback) {
        sendWelcomeEmail(user, callback);
      },
      function (callback) {
        req.logIn(user, function (err) {
          callback(err)
        })
      }
    ], function (err) {
      if (err) return next(err);
        res.render('account/newaccount', {
          activities: activities.activityMap,
        });
    });
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
    aws.config.accessKeyId = secrets.aws.accessKeyId;
    aws.config.secretAccessKey = secrets.aws.secretAccessKey;
    aws.config.region = secrets.aws.region;
    var BUCKET_NAME = secrets.aws.bucketName;

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
          user.profile.picture = 'https://s3.' + secrets.aws.region + '.' + 'amazonaws.com/' + secrets.aws.bucketName + '/' + filename;
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
          user: secrets.mailgun.user,
          pass: secrets.mailgun.password
        }
      });
      const mailOptions = {
        to: user.email,
        from: 'team@shareonbazaar.eu',
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
          user: secrets.mailgun.user,
          pass: secrets.mailgun.password
        }
      });
      const mailOptions = {
        to: user.email,
        from: 'team@shareonbazaar.eu',
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
 * FIXME: change name of this func
 */
exports.findUsers = (req, res) => {
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

        user.skills = activities.populateLabels(user.skills);

        if (typeof user.loc.coordinates === 'undefined') {
          user.loc.coordinates = [null, null];
        }
    })
    res.render('users/showall', {
        users: results,
        current_user_interests: activities.populateLabels(my_interests),
    });
  });
};

exports.search = (req, res) => {
  // FIXME: switch on request type, json or HTML
  User.find({skills: {'$in': req.query.skills}}, (err, results) => {
    async.map(results, (item, cb) => {
      item.skills = activities.populateLabels(item.skills);
      res.app.render('partials/userCard', {
        layout: false,
        curr_user: req.user,
        card_user: item,
      }, cb)
    }, (err, response) => {
      res.json(response);
    });
  });
}

exports.surprise = (req, res) => {
    // FIXME: Match on one skill/interest overlap
    User.find({}, (err, results) => {
        var match = results[Math.floor(Math.random() * (results.length))];
        res.redirect('/profile/' + match._id)
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
    if (user === null) {
      res.status(404).render('error/404', {
        status: 404,
        url: req.url,
      });
      return;
    }
    user.skills = activities.populateLabels(user.skills);
    user.interests = activities.populateLabels(user.interests);
    Transaction.find({'_recipient': user._id}, function (err, transactions) {
      res.render('users/profile', {
          spotlight_user: user,
          transactions: transactions,
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
            user.skills = activities.populateLabels(user.skills);
        });
        res.render('users/bookmarks', {
            users: users,
            current_user_interests: activities.populateLabels(my_interests),
        });
    });
}

var email_template = fs.readFileSync('config/welcome_email.html', 'utf8');

function sendWelcomeEmail (user, callback) {
    var transporter = nodemailer.createTransport({
      service: 'Mailgun',
      auth: {
        user: secrets.mailgun.user,
        pass: secrets.mailgun.password,
      },
    });

    var html_content = email_template.replace('{recipient}', user.profile.name);

    var mailOptions = {
      to: user.email,
      from: 'Bazaar Team <team@shareonbazaar.eu>',
      subject: 'Welcome to the Bazaar, ' + user.profile.name,
      text: 'Hi ' + user.profile.name + ',\n\n' +
        'Thanks for signing up to Bazaar!.\n',
      html: html_content,
    };
    transporter.sendMail(mailOptions, function (err) {
      callback(err);
    });
}

/**
 * Send welcome email to a user after registration
 */
exports.sendWelcomeEmail = sendWelcomeEmail;
