const helpers = require('./helpers');
const Skill = require('../models/Skill');

/**
 * GET /skills/list
 * List all skills
 */
exports.list = (req, res) => {
    if (!req.query.term) {
        return res.json({
            error: "No term specified",
        });
    }
    var regex = new RegExp(req.query.term.replace(/\\/g, ''), 'i');
    Skill.find({'label.en': {$regex: regex}})
    .sort('label.en')
    .exec((err, results) => {
        res.json(results.map((skill) => {
            return {
                name: skill.label['en'],
                id: skill._id,
            };
        }));
    });
};
