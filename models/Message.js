var mongoose = require('mongoose');

var messageSchema = new mongoose.Schema({
  message: String,
  _transaction: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' },
  _sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('Message', messageSchema);
