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
const apiController = require('./controllers/api');
const transactionController = require('./controllers/transaction');
const contactController = require('./controllers/contact');
const messageController = require('./controllers/message');

/**
 * API keys and Passport configuration.
 */
const passportConfig = require('./config/passport');

var Message = require('./models/Message');
var Thread = require('./models/Thread');

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
app.use((req, res, next) => {
  if (req.path === '/api/upload') {
    next();
  } else {
    lusca.csrf()(req, res, next);
  }
});
app.use(lusca.xframe('SAMEORIGIN'));
app.use(lusca.xssProtection(true));
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

var io = require('socket.io').listen(server);
var passportSocketIo = require("passport.socketio");
var async = require('async');

function onAuthorizeSuccess(data, accept){
  console.log('successful connection to socket.io');
  accept();
}

function onAuthorizeFail(data, message, error, accept){
  console.log('failed connection to socket.io:', message);
  if(error) {
    accept(new Error(message));
  }
}

//With Socket.io >= 1.0
io.use(passportSocketIo.authorize({
  cookieParser: cookieParser,
  key:          'connect.sid',
  secret:       secrets.sessionSecret,
  store:        store,
  success:      onAuthorizeSuccess,
  fail:         onAuthorizeFail,
}));

var socket_map = {};

function saveMessage (socket, data, thread_id, callback) {
    var newMsg = new Message({
        message: data.message,
        timeSent: new Date(),
        _thread: thread_id,
        _sender: socket.request.user._id,
    });
    newMsg.save(function (err) {
        if (err) {
            throw err;
        }
        callback(null, socket, data, thread_id, newMsg)
    });
}

function sendMessage (socket, data, thread_id, newMsg, callback) {
    Thread.findOne({_id: thread_id})
    .populate('_participants')
    .exec(function (err, thread) {
        thread._participants.forEach(function (user) {
            io.to(socket_map[user._id]).emit('new message', {
                message: newMsg.message,
                timeSent: newMsg.timeSent,
                thread: thread,
                author: {
                    name: socket.request.user.profile.name,
                    pic: socket.request.user.profile.picture,
                    id: socket.request.user._id,
                    isMe: socket.request.user._id.toString() == user._id.toString(),
                },
            });
        });
        callback(null);
    });
}

function saveThread (socket, data, unused_id, callback) {
    var newThread = new Thread({
        _participants: [socket.request.user._id].concat(data.to).sort(),
        lastUpdated: new Date(),
    });

    newThread.save(function (err) {
        callback(null, socket, data, newThread._id);
    });
}

io.sockets.on('connection', function (socket) {
    socket_map[socket.request.user._id] = socket.id;
    socket.on('send message', function (data) {
        var arr = [
            saveMessage,
            sendMessage,
        ];

        if (data.isNewThread) {
            arr.unshift(saveThread);
        }

        arr.unshift(function (callback) {
            callback(null, socket, data, data.thread_id);
        })

        async.waterfall(arr, function (err, results) {
            if (err) {
                console.log("Error: " + err);
            }
        });
    });
});

/**
 * Primary app routes.
 */
app.get('/', homeController.index);
app.get('/privacy', homeController.privacy);
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
app.post('/account/profile', passportConfig.isAuthenticated, userController.postUpdateProfile);
app.post('/account/password', passportConfig.isAuthenticated, userController.postUpdatePassword);
app.post('/account/delete', passportConfig.isAuthenticated, userController.postDeleteAccount);
app.get('/account/unlink/:provider', passportConfig.isAuthenticated, userController.getOauthUnlink);
app.get('/messages', passportConfig.isAuthenticated, messageController.showMessages);
app.get('/_threadMessages/:id', passportConfig.isAuthenticated, messageController.getMessages);
app.get('/profile/:id', passportConfig.isAuthenticated, userController.showProfile);

app.get('/transactions', passportConf.isAuthenticated, transactionController.showTransactions);
app.post('/transactions', passportConf.isAuthenticated, transactionController.postTransaction);

/**
 * User routes
 */
app.get('/users', passportConf.isAuthenticated, userController.findUsers);
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
  res.redirect(req.session.returnTo || '/');
});
app.get('/auth/google', passport.authenticate('google', { scope: 'profile email' }));
app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/login' }), (req, res) => {
  res.redirect(req.session.returnTo || '/');
});
app.get('/auth/twitter', passport.authenticate('twitter'));
app.get('/auth/twitter/callback', passport.authenticate('twitter', { failureRedirect: '/login' }), (req, res) => {
  res.redirect(req.session.returnTo || '/');
});

/**
 * Error Handler.
 */
app.use(errorHandler());

/**
 * Start Express server.
 */
app.listen(app.get('port'), () => {
  console.log('Express server listening on port %d in %s mode', app.get('port'), app.get('env'));
});

module.exports = app;
