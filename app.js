require('dotenv').config()
var express = require('express'),
    mongoose = require('mongoose'),
    passport = require('passport'),
    flash = require('connect-flash'),
    bodyParser = require('body-parser'),
    localStrategy = require('passport-local'),
    expressSession = require('express-session'),
    methodOverride = require('method-override'),
    reviewRoutes = require("./routes/reviews"),
    User = require('./models/user'),
    commentRoutes = require('./routes/comments'),
    campgroundsRoutes = require('./routes/campground'),
    indexRoutes = require('./routes/index'),
    app = express(),
    port = 3000

mongoose.connect(process.env.DBURL, { useNewUrlParser: true, useUnifiedTopology: true, useCreateIndex: true, useFindAndModify: false });

// order is extremly important
app.locals.moment = require('moment')
app.use(bodyParser.urlencoded({ extended: true }))
app.use(express.static(__dirname + '/public'))
app.use(methodOverride('_method'))
app.use(flash())

// seedDB()

app.use(expressSession({
    secret: process.env.SECRETSESSION,
    resave: false,
    saveUninitialized: false
}))

app.use(passport.initialize())
app.use(passport.session())


passport.use(new localStrategy(User.authenticate()))
passport.serializeUser(User.serializeUser())
passport.deserializeUser(User.deserializeUser())

app.use(async (req, res, next) => {
    res.locals.currentUser = req.user
    if (req.user) {
        try {
            let user = await User.findById(req.user._id).populate('notifications', null, { isRead: false }).exec(); //populate only if isRead = false
            res.locals.notifications = user.notifications.reverse(); //create locals.notifications ...reverse for decending
        } catch (err) {
            console.log(err.message);
        }
    }
    res.locals.error = req.flash('error')
    res.locals.success = req.flash('success')
    next()
})

app.use(indexRoutes)


// make url shorter
// app.use(/campground, campgroundsRoutes)
//if this is apllied then
// router.post('/campgrounds', (req, res) => {
// becomes router.post('/', (req, res) => {   or   router.post((req, res) => {
//also this is nedded to get params   router = express.Router({mergeParams: true})

app.use(campgroundsRoutes)
app.use(commentRoutes)
app.use(reviewRoutes)

app.listen(process.env.PORT, process.env.IP, () => {
    console.log('YelpCamp Application is running')
})