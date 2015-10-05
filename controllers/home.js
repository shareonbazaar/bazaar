/**
 * GET /
 * Home page.
 */
exports.index = function(req, res) {
  res.render('home', {
    title: 'Home'
  });
};

exports.privacy = function(req, res) {
  res.render('privacy');
};

exports.about = function(req, res) {
  res.render('about');
};