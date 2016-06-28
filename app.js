/**
 * Module dependencies.
 */
var express = require('express');
var cookieParser = require('cookie-parser');
var compress = require('compression');
var favicon = require('serve-favicon');
var session = require('express-session');
var bodyParser = require('body-parser');
var logger = require('morgan');
var errorHandler = require('errorhandler');
var lusca = require('lusca');
var methodOverride = require('method-override');

var _ = require('lodash');
var MongoStore = require('connect-mongo')(session);
var flash = require('express-flash');
var path = require('path');
var mongoose = require('mongoose');
var passport = require('passport');
var expressValidator = require('express-validator');
var assets = require('connect-assets');

/**
 * Controllers (route handlers).
 */
var homeController = require('./controllers/home');
var userController = require('./controllers/user');
var adminController = require('./controllers/admin');
var transactionController = require('./controllers/transaction');
var messageController = require('./controllers/message');
var contactController = require('./controllers/contact');

/**
 * API keys and Passport configuration.
 */
var secrets = require('./config/secrets');
var passportConf = require('./config/passport');
var activities = require('./config/activities');

/**
 * Create Express server.
 */
var app = express();

var server = require('http').createServer(app);

/**
 * Connect to MongoDB.
 */
mongoose.connect(secrets.db);
mongoose.connection.on('error', function() {
  console.error('MongoDB Connection Error. Please make sure that MongoDB is running.');
});

/**
 * Express configuration.
 */
app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(compress());
app.use(assets({
  paths: ['public/css', 'public/js']
}));
app.use(logger('dev'));
app.use(favicon(path.join(__dirname, 'public/favicon.png')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(expressValidator());
app.use(methodOverride());
app.use(cookieParser());
var store = new MongoStore({ url: secrets.db, autoReconnect: true });
app.use(session({
  name: 'connect.sid',
  resave: true,
  saveUninitialized: true,
  secret: secrets.sessionSecret,
  store: store
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

var multer  = require('multer')
var storage = multer.memoryStorage()
var upload = multer({ storage: storage })
app.use(upload.single('profilepic'));

app.use(lusca({
  csrf: true,
  xframe: 'SAMEORIGIN',
  xssProtection: true
}));
app.use(function(req, res, next) {
  res.locals.user = req.user;
  next();
});
app.use(express.static(path.join(__dirname, 'public'), { maxAge: 31557600000 }));

// Initialize the sockets for sending and receiving messages
messageController.initSockets(server, store, cookieParser);

/**
 * Primary app routes.
 */
app.get('/', function (req, res) {
    if (req.isAuthenticated()) {
        userController.findUsers(req, res);
    } else {
        homeController.index(req, res);
    }
});
app.get('/privacy', homeController.privacy);
app.get('/newaccount', passportConf.isAuthenticated, function (req, res) {
  res.render('account/newaccount', {
    my_skills: [],
    my_interests: [],
    activities: activities.activityMap,
  })
});
app.post('/newaccount', userController.newAccount);
app.get('/about', homeController.about);
app.get('/newabout', homeController.newabout);
app.get('/login', userController.getLogin);
app.post('/login', userController.postLogin);
app.get('/logout', userController.logout);
app.get('/forgot', userController.getForgot);
app.post('/forgot', userController.postForgot);
app.get('/reset/:token', userController.getReset);
app.post('/reset/:token', userController.postReset);
app.get('/signup', userController.getSignup);
app.post('/signup', userController.postSignup);
app.get('/contact', contactController.getContact);
app.post('/contact', contactController.postContact);
app.get('/account', passportConf.isAuthenticated, userController.getAccount);
app.get('/admin/sendEmail', passportConf.isAdmin, adminController.getSendEmail);
app.post('/admin/sendEmail', passportConf.isAdmin, adminController.postSendEmail);
app.post('/account/profile', passportConf.isAuthenticated, userController.postUpdateProfile);
app.post('/account/password', passportConf.isAuthenticated, userController.postUpdatePassword);
app.post('/account/delete', passportConf.isAuthenticated, userController.postDeleteAccount);
app.get('/account/unlink/:provider', passportConf.isAuthenticated, userController.getOauthUnlink);
app.get('/messages', passportConf.isAuthenticated, messageController.showMessages);
app.get('/_threadMessages/:id', passportConf.isAuthenticated, messageController.getMessages);
app.get('/_numUnreadThreads', passportConf.isAuthenticated, function (req, res) {
    res.json({
        count: req.user.unreadThreads.length,
    });
});

app.get('/_ackThread/:id', passportConf.isAuthenticated, function (req, res) {
    var index = req.user.unreadThreads.indexOf(req.params.id);
    if (index >= 0) {
        req.user.unreadThreads.splice(index, 1);
    }
    req.user.save(function (err) {
        if (err) {
            console.log(err);
        }
        res.json({
            count: req.user.unreadThreads.length,
        });
    });
});

app.get('/profile/:id', passportConf.isAuthenticated, userController.showProfile);

app.get('/transactions', passportConf.isAuthenticated, transactionController.showTransactions);
app.post('/transactions', passportConf.isAuthenticated, transactionController.postTransaction);
app.post('/acceptRequest', passportConf.isAuthenticated, transactionController.postAccept);
app.get('/confirmExchange/:id', passportConf.isAuthenticated, transactionController.confirmExchange);

app.post('/location', passportConf.isAuthenticated, userController.postLocation);

/**
 * User routes
 */
app.get('/users', passportConf.isAuthenticated, userController.findUsers);
app.get('/users/list', userController.list);
app.get('/api/users', userController.allUsers);

/**
 * OAuth authentication routes. (Sign in)
 */
app.get('/auth/facebook', passport.authenticate('facebook', { scope: ['email', 'public_profile', 'user_location', 'user_hometown'] }));
app.get('/auth/facebook/callback', passport.authenticate('facebook', { failureRedirect: '/login' }), function(req, res) {
  res.redirect(req.session.returnTo || '/account');
});
app.get('/auth/google', passport.authenticate('google', { scope: 'profile email' }));
app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/login' }), function(req, res) {
  res.redirect(req.session.returnTo || '/account');
});
app.get('/auth/twitter', passport.authenticate('twitter'));
app.get('/auth/twitter/callback', passport.authenticate('twitter', { failureRedirect: '/login' }), function(req, res) {
  res.redirect(req.session.returnTo || '/account');
});


/**
 * Error Handler.
 */
if (app.settings.env === 'production') {
  app.use(function(req, res, next){
    // the status option, or res.statusCode = 404
    // are equivalent, however with the option we
    // get the "status" local available as well
    res.status(404).render('error/404', {
      status: 404,
      url: req.url,
    });
  });
  app.use(function(err, req, res, next){
    // we may use properties of the error object
    // here and next(err) appropriately, or if
    // we possibly recovered from the error, simply next().
    res.status(500).render('error/500', {
        status: err.status || 500,
        error: err,
    });
  });
} else {
  app.use(errorHandler());
}

/**
 * Start Express server.
 */
server.listen(app.get('port'), function() {
  console.log('Express server listening on port %d in %s mode', app.get('port'), app.get('env'));
});
module.exports = app;
