var mongoose = require('mongoose');

var reviewSchema = new mongoose.Schema({
  text: { type: String, default: '' },
  rating: Number,
  _transaction: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' },
  _creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  _subject: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('Review', reviewSchema);
