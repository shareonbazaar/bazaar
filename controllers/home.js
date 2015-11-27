/**
 * GET /
 * Home page.
 */

exports.index = (req, res) => {
  res.render('splash', {
    title: 'Home'
  });
};

exports.privacy = (req, res) => {
  res.render('privacy');
};

exports.about = (req, res) => {
  res.render('about');
};

exports.splash = (req, res) => {
  res.render('splash');
};
