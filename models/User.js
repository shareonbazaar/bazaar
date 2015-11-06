var bcrypt = require('bcrypt-nodejs');
var crypto = require('crypto');
var mongoose = require('mongoose');

var userSchema = new mongoose.Schema({
  email: { type: String, unique: true, lowercase: true },
  password: String,
  aboutMe: { type: String, default: '' },
  skills: {type: Array, default: []},
  interests: {type: Array, default: []},
  coins: { type: Number, default: 5 },
  loc : {
    type: {type: String},
    coordinates: { type: [], index: '2dsphere' }
  },

  unreadThreads: [String],

  facebook: String,
  twitter: String,
  google: String,
  tokens: Array,

  profile: {
    name: { type: String, default: '' },
    gender: { type: String, default: '' },
    status: { type: String, default: '' },
    location: { type: String, default: '' },
    hometown: { type: String, default: '' },
    picture: { type: String, default: 'http://bazaar.intrst.de/images/person_placeholder.gif' }
  },

  resetPasswordToken: String,
  resetPasswordExpires: Date
});

userSchema.index({loc: '2dsphere'});

/**
 * Password hash middleware.
 */
userSchema.pre('save', function(next) {
  var user = this;
  if (!user.isModified('password')) return next();
  bcrypt.genSalt(10, function(err, salt) {
    if (err) return next(err);
    bcrypt.hash(user.password, salt, null, function(err, hash) {
      if (err) return next(err);
      user.password = hash;
      next();
    });
  });
});

/**
 * Helper method for validating user's password.
 */
userSchema.methods.comparePassword = function(candidatePassword, cb) {
  bcrypt.compare(candidatePassword, this.password, function(err, isMatch) {
    if (err) return cb(err);
    cb(null, isMatch);
  });
};

/**
 * Helper method for getting user's gravatar.
 */
userSchema.methods.gravatar = function(size) {
  if (!size) size = 200;
  if (!this.email) return 'https://gravatar.com/avatar/?s=' + size + '&d=retro';
  var md5 = crypto.createHash('md5').update(this.email).digest('hex');
  return 'https://gravatar.com/avatar/' + md5 + '?s=' + size + '&d=retro';
};

module.exports = mongoose.model('User', userSchema);
