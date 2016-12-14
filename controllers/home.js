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
  res.render('privacy', {
    title: 'Privacy Policy',
  });
};

exports.about = (req, res) => {
  res.render('about', {
    title: 'About',
  });
};

exports.splash = (req, res) => {
  res.render('splash');
};
