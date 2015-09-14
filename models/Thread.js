var mongoose = require('mongoose');

var threadSchema = new mongoose.Schema({
  _participants:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  lastUpdated: Date,
  name: String,
});

module.exports = mongoose.model('Thread', threadSchema);
