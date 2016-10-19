const bcrypt = require('bcrypt-nodejs');
const crypto = require('crypto');
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, unique: true },
  password: String,
  passwordResetToken: String,
  passwordResetExpires: Date,
  aboutMe: { type: String, default: '' },
  _skills: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Skill' }],
  _interests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Skill' }],

  coins: { type: Number, default: 5 },
  loc : {
    type: {type: String},
    coordinates: { type: [], index: '2dsphere', get: NullInitialization }
  },

  bookmarks:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  unreadThreads: [String],

  facebook: String,
  google: String,
  tokens: Array,
  isAdmin: { type: Boolean, default: false },

  profile: {
    name: { type: String, default: '' },
    gender: { type: String, default: '' },
    status: { type: String, default: '' },
    location: { type: String, default: '' },
    hometown: { type: String, default: '' },
    picture: { type: String, default: '' },
  }
}, { timestamps: true });

userSchema.index({loc: '2dsphere'});

// Give coordinates a default value if they don't exist
function NullInitialization (coordinates) {
    if (typeof coordinates === 'undefined' || coordinates.length < 2) {
        return [null, null];
    }
    return coordinates;
}

/**
 * Password hash middleware.
 */
userSchema.pre('save', function (next) {
  const user = this;
  if (!user.isModified('password')) { return next(); }
  bcrypt.genSalt(10, (err, salt) => {
    if (err) { return next(err); }
    bcrypt.hash(user.password, salt, null, (err, hash) => {
      if (err) { return next(err); }
      user.password = hash;
      next();
    });
  });
});

/**
 * Helper method for validating user's password.
 */
userSchema.methods.comparePassword = function (candidatePassword, cb) {
  bcrypt.compare(candidatePassword, this.password, (err, isMatch) => {
    cb(err, isMatch);
  });
};

/**
 * Helper method for getting user's gravatar.
 */
userSchema.methods.gravatar = function (size) {
  if (!size) {
    size = 200;
  }
  if (!this.email) {
    return `https://gravatar.com/avatar/?s=${size}&d=retro`;
  }
  const md5 = crypto.createHash('md5').update(this.email).digest('hex');
  return `https://gravatar.com/avatar/${md5}?s=${size}&d=retro`;
};

const User = mongoose.model('User', userSchema);

module.exports = User;
