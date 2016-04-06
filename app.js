/**
 * Module dependencies.
 */
const express = require('express');
const compression = require('compression');
const session = require('express-session');
const bodyParser = require('body-parser');
const logger = require('morgan');
const errorHandler = require('errorhandler');
const lusca = require('lusca');
const dotenv = require('dotenv');
const MongoStore = require('connect-mongo')(session);
const flash = require('express-flash');
const path = require('path');
const mongoose = require('mongoose');
const passport = require('passport');
const expressValidator = require('express-validator');
const sass = require('node-sass-middleware');
const multer = require('multer');
const upload = multer({ dest: path.join(__dirname, 'uploads') });

/**
 * Load environment variables from .env file, where API keys and passwords are configured.
 */
dotenv.load({ path: '.env.example' });

/**
 * Controllers (route handlers).
 */
const homeController = require('./controllers/home');
const userController = require('./controllers/user');
const adminController = require('./controllers/admin');
const transactionController = require('./controllers/transaction');
const messageController = require('./controllers/message');
const apiController = require('./controllers/api');
const contactController = require('./controllers/contact');

/**
 * API keys and Passport configuration.
 */
const secrets = require('./config/secrets');
const passportConfig = require('./config/passport');
const activities = require('./config/activities');

/**
 * Create Express server.
 */
const app = express();

var server = require('http').createServer(app);

/**
 * Connect to MongoDB.
 */
mongoose.connect(process.env.MONGODB_URI || process.env.MONGOLAB_URI);
mongoose.connection.on('error', () => {
  console.error('MongoDB Connection Error. Please make sure that MongoDB is running.');
  process.exit(1);
});

/**
 * Express configuration.
 */
app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(compression());
app.use(sass({
  src: path.join(__dirname, 'public'),
  dest: path.join(__dirname, 'public')
}));
app.use(logger('dev'));
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
app.use((req, res, next) => {
  res.locals.user = req.user;
  next();
});
app.use((req, res, next) => {
  // After successful login, redirect back to /api, /contact or /
  if (/(api)|(contact)|(^\/$)/i.test(req.path)) {
    req.session.returnTo = req.path;
  }
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
app.get('/newaccount', passportConfig.isAuthenticated, function (req, res) {
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
app.get('/account', passportConfig.isAuthenticated, userController.getAccount);
app.get('/admin/sendEmail', passportConfig.isAdmin, adminController.getSendEmail);
app.post('/admin/sendEmail', passportConfig.isAdmin, adminController.postSendEmail);
app.post('/account/profile', passportConfig.isAuthenticated, userController.postUpdateProfile);
app.post('/account/password', passportConfig.isAuthenticated, userController.postUpdatePassword);
app.post('/account/delete', passportConfig.isAuthenticated, userController.postDeleteAccount);
app.get('/account/unlink/:provider', passportConfig.isAuthenticated, userController.getOauthUnlink);
app.get('/messages', passportConfig.isAuthenticated, messageController.showMessages);
app.get('/_threadMessages/:id', passportConfig.isAuthenticated, messageController.getMessages);
app.get('/_numUnreadThreads', passportConfig.isAuthenticated, (req, res) => {
    res.json({
        count: req.user.unreadThreads.length,
    });
});

app.get('/_ackThread/:id', passportConfig.isAuthenticated, function (req, res) {
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

app.get('/profile/:id', passportConfig.isAuthenticated, userController.showProfile);

app.get('/transactions', passportConfig.isAuthenticated, transactionController.showTransactions);
app.post('/transactions', passportConfig.isAuthenticated, transactionController.postTransaction);

app.post('/location', passportConfig.isAuthenticated, userController.postLocation);

/**
 * User routes
 */
app.get('/users', passportConfig.isAuthenticated, userController.findUsers);
app.get('/users/list', userController.list);


/**
 * API examples routes.
 */
app.get('/api', apiController.getApi);
app.get('/api/facebook', passportConfig.isAuthenticated, passportConfig.isAuthorized, apiController.getFacebook);
app.get('/api/twitter', passportConfig.isAuthenticated, passportConfig.isAuthorized, apiController.getTwitter);
app.post('/api/twitter', passportConfig.isAuthenticated, passportConfig.isAuthorized, apiController.postTwitter);

/**
 * OAuth authentication routes. (Sign in)
 */
app.get('/auth/facebook', passport.authenticate('facebook', { scope: ['email', 'public_profile', 'user_location', 'user_hometown'] }));
app.get('/auth/facebook/callback', passport.authenticate('facebook', { failureRedirect: '/login' }), (req, res) => {
  res.redirect(req.session.returnTo || '/account');
});
app.get('/auth/google', passport.authenticate('google', { scope: 'profile email' }));
app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/login' }), (req, res) => {
  res.redirect(req.session.returnTo || '/account');
});
app.get('/auth/twitter', passport.authenticate('twitter'));
app.get('/auth/twitter/callback', passport.authenticate('twitter', { failureRedirect: '/login' }), (req, res) => {
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
app.listen(app.get('port'), () => {
  console.log('Express server listening on port %d in %s mode', app.get('port'), app.get('env'));
});

module.exports = app;
