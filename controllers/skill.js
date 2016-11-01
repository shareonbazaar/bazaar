const Skill = require('../models/Skill');

/**
 * GET /skills/list
 * List all skills
 */
exports.list = (req, res) => {
    var query = {};
    if (typeof req.query.term === 'string') {
        try {
            var regex = new RegExp(req.query.term, 'i');
            query = {'label.en': {$regex: regex}};
        } catch (err) {
            // invalid regex - just list all users
        }
    }
    Skill.find(query)
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
