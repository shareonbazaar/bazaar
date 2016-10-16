const fs = require('fs');

exports.up = function(db, next) {
    var activities = JSON.parse(fs.readFileSync('config/activities.json', 'utf8'));

    Object.keys(activities).reduce((previous_promise, category_name) => {
        var new_category = {label: {en: category_name}, _skills: []};

        return activities[category_name].reduce((previous_promise, skill_label) => {
            return previous_promise.then(() => {
                return db.collection('skills').insertOne({label: {en: skill_label}})
                .then((result) => {
                    new_category._skills.push(result.insertedId);
                });
            });
        }, Promise.resolve()).then(() => {
            return db.collection('categories').insertOne(new_category);
        });
    }, Promise.resolve()).then(() => {
        next();
    });
};

exports.down = function(db, next) {
    var activities = JSON.parse(fs.readFileSync('config/activities.json', 'utf8'));
    var promises = [];
    Object.keys(activities).forEach((category_name) => {
        var skills = activities[category_name];

        promises = promises.concat(skills.map((skill_label) => {
            return db.collection('skills').remove({'label.en': skill_label});
        }));

        promises.push(db.collection('categories').remove({'label.en': category_name}))
    });
    Promise.all(promises).then(() => {
        next()
    })
};
