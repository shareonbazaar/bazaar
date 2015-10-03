var fs = require('fs');

var activities = JSON.parse(fs.readFileSync('config/activities.json', 'utf8'));

exports.activityMap = activities;

exports.getActivityLabelForName = function (name) {
  for (var category in activities) {
      var match = activities[category].filter(function (activity) {
          return activity.name == name;
      });
      if (match && match.length > 0) {
          return match[0].label;
      }
  }
  return '';
}

exports.getAllActivityLabels = function () {
    return Object.keys(activities).map(function (category) {
        return activities[category];
    }).reduce(function (list, arr) {
        return list.concat(arr);
    }, []);
}
