const _ = require('lodash');
const async = require('async');
const crypto = require('crypto');
const fs = require('fs');
const nodemailer = require('nodemailer');
const passport = require('passport');
const User = require('../models/User');
const Thread = require('../models/Thread');
const Transaction = require('../models/Transaction');
const secrets = require('../config/secrets');
const activities = require('../config/activities');

function toObjectId(str) {
    var ObjectId = (require('mongoose').Types.ObjectId);
    return new ObjectId(str);
};

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
    user.save((err) => {
      if (err) return next(err);
      req.logIn(user, (err) => {
        if (err) return next(err);
        res.redirect('/account');
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

/**
 * POST /account/profile
 * Update profile information.
 */
exports.postUpdateProfile = (req, res, next) => {
  req.assert('email', 'Please enter a valid email address.').isEmail();
  req.sanitize('email').normalizeEmail({ remove_dots: false });

  const errors = req.validationErrors();

  if (errors) {
    req.flash('errors', errors);
    return res.redirect('/account');
  }

  User.findById(req.user.id, (err, user) => {
    if (err) { return next(err); }
    user.email = req.body.email || '';
    user.profile.name = req.body.name || '';
    user.profile.gender = req.body.gender || '';
    user.profile.status = req.body.status || '';
    user.profile.location = req.body.location || '';
    user.profile.hometown = req.body.hometown || '';
    user.aboutMe = req.body.aboutme || '';
    user.interests = JSON.parse(req.body.interests) || [];
    user.skills = JSON.parse(req.body.skills) || [];
    user.save((err) => {
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
        from: 'hackathon@starter.com',
        subject: 'Your Hackathon Starter password has been changed',
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
        from: 'hackathon@starter.com',
        subject: 'Reset your password on Hackathon Starter',
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
        if (interests_match > 0 && skills_match > 0) {
            user.match = 'both';
        } else if (interests_match > 0 || skills_match > 0) {
            user.match = 'one';
        } else {
            user.match = 'none';
        }
        user.skill_labels = user.skills.map(activities.getActivityLabelForName);
    })
    res.render('users/showall', {
        users: results,
    });
  });
};

/**
 * GET /list
 * List all users whose name matches the query term. Used for searching
 */
exports.list = function(req, res) {
  var regex = new RegExp(req.query.term, 'i')
  User.find({'profile.name': {$regex: regex}}, function (err, results) {
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
    var participants = [req.params.id, req.user.id].sort().map(toObjectId);
    user.skill_labels = user.skills.map(activities.getActivityLabelForName);
    user.interest_labels = user.interests.map(activities.getActivityLabelForName);
    Thread.find({'_participants': participants}, function (err, threads) {
      Transaction.find({'_recipient': user._id}, function (err, transactions) {
        res.render('users/profile', {
            spotlight_user: user,
            thread_id: threads.length > 0 ? threads[0].id : -1,
            transactions: transactions,
        });
      })
    })
  });
};
