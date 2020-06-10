Campground = require('../models/campground'),
    Comment = require('../models/comment'),
    Review = require("../models/review")

var middlewareObj = {}

middlewareObj.checkCampgroundOwnerShip = function (req, res, next) {
    if (req.isAuthenticated()) {
        Campground.findOne({slug: req.params.slug}, (err, foundCampground) => {
            if (err || !foundCampground) { // or foundCampground == undefined
                req.flash('error', 'Campground not found')
                res.redirect('back')
            } else {
                if (foundCampground.author.id.equals(req.user._id) || req.user.isAdmin) {
                    next()
                }
            }
        })
    } else {
        req.flash('error', 'You need to be logged in!')
        res.redirect('/login')
    }
}

middlewareObj.checkReviewOwnership = function(req, res, next) {
    if(req.isAuthenticated()){
        Review.findById(req.params.review_id, function(err, foundReview){
            if(err || !foundReview){
                res.redirect("back");
            }  else {
                // does user own the comment?
                if(foundReview.author.id.equals(req.user._id)) {
                    next();
                } else {
                    req.flash("error", "You don't have permission to do that");
                    res.redirect("back");
                }
            }
        });
    } else {
        req.flash("error", "You need to be logged in to do that");
        res.redirect("back");
    }
};

middlewareObj.checkReviewExistence = function (req, res, next) {
    if (req.isAuthenticated()) {
        Campground.findOne({slug: req.params.slug}).populate("reviews").exec(function (err, foundCampground) {
            if (err || !foundCampground) {
                req.flash("error", "Campground not found.");
                res.redirect("back");
            } else {
                // check if req.user._id exists in foundCampground.reviews
                var foundUserReview = foundCampground.reviews.some(function (review) {
                    return review.author.id.equals(req.user._id);
                });
                if (foundUserReview) {
                    req.flash("error", "You already wrote a review.");
                    return res.redirect("/campgrounds/" + foundCampground.slug);
                }
                // if the review was not found, go to the next middleware
                next();
            }
        });
    } else {
        req.flash("error", "You need to login first.");
        res.redirect("back");
    }
};


middlewareObj.checkCommentOwnerShip = function (req, res, next) {
    if (req.isAuthenticated()) {
        Comment.findById(req.params.comment_id, (err, foundComment) => {
            if (err) {
                req.flash('error', 'comment not found')
                res.redirect('back')
            } else {
                if (foundComment.author.id.equals(req.user._id) || req.user.isAdmin) {
                    next()
                } else {
                    req.flash('error', 'You do not have permission!')
                    res.redirect('back')
                }
            }
        })
    } else {
        req.flash('error', 'You need to be logged in!')
        res.redirect('/login')
    }

}

middlewareObj.isLoggedIn = function (req, res, next) {
    if (req.isAuthenticated()) {
        return next()
    }
    req.flash('error', 'You need to be logged in!')
    res.redirect('/login')
}


module.exports = middlewareObj