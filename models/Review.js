var mongoose = require('mongoose');

var reviewSchema = new mongoose.Schema({
  timeSent: Date,
  text: { type: String, default: '' },
  rating: Number,
  _transaction: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' },
  _creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  _subject: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
});

module.exports = mongoose.model('Review', reviewSchema);
