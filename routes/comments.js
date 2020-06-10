var express = require('express'),
    router = express.Router(),
    Campground = require('../models/campground'),
    Comment = require('../models/comment'),
    middleware = require('../middleware/index')


router.get('/campgrounds/:slug/comments/new', middleware.isLoggedIn, (req, res) => {
    Campground.findOne({slug: req.params.slug}, (err, campground) => {
        if (!err) {
            res.render('comments/new.ejs', { campground: campground })
        }
    })
})

router.post('/campgrounds/:slug/comments', (req, res) => {
    Campground.findOne({slug: req.params.slug}, (err, campground) => {
        if (!err) {
            Comment.create(req.body.comment, (err, comment) => {
                if (!err) {
                    comment.author.id = req.user._id
                    comment.author.username = req.user.username
                    comment.save()
                    campground.comments.push(comment)
                    campground.save()
                    req.flash('success', 'successfully added comment')
                    res.redirect('/campgrounds/' + campground.slug)
                }
            })
        }
    })
})

router.get('/campgrounds/:slug/comments/:comment_id/edit', middleware.checkCommentOwnerShip, (req, res) => {
    Campground.findOne({slug: req.params.slug}, (err, campground) => {
        if (err || !campground) {
            req.flash('error', 'Campground not found')
            return res.redirect('back') // return is used no need for else
        }
        Comment.findById(req.params.comment_id, (err, foundComment) => {
            if (!err) {
                res.render('comments/edit.ejs', { campground_slug: req.params.slug, comment: foundComment })
            }
        })
    })
})

router.put('/campgrounds/:slug/comments/:comment_id', middleware.checkCommentOwnerShip, (req, res) => {
    Comment.findByIdAndUpdate(req.params.comment_id, req.body.comment, (err, updatedComment) => {
        if (!err) {
            res.redirect('/campgrounds/' + req.params.slug)
        }
    })
})

router.delete('/campgrounds/:slug/comments/:comment_id', middleware.checkCommentOwnerShip, (req, res) => {
    Comment.findByIdAndRemove(req.params.comment_id, (err, foundComment) => {
        if (!err) {
            Campground.findOneAndUpdate({slug: req.params.slug}, { $pull: { comments: req.params.comment_id } }, (err, updatedCampground) => {
                if (err) {
                    return console.log(err);
                    
                }
                req.flash('success', 'comment deleted!')
                res.redirect("/campgrounds/" + req.params.slug);
            })
        }
    })
})


module.exports = router