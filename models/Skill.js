var mongoose = require('mongoose');

var skillSchema = new mongoose.Schema({
  label: { type: {type: String} },
}, { timestamps: true });

module.exports = mongoose.model('Skill', skillSchema);
