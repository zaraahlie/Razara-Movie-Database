const mongoose = require("mongoose");
const ObjectId= require('mongoose').Types.ObjectId;
const Movie = require("./models/MovieModel");
const User = require("./models/UserModel");
const Person = require("./models/PersonModel");
const Review = require("./models/ReviewModel");
const Notifcation = require("./models/NotificationModel");
const express = require('express');
let router = express.Router();

/*
router.get("/:id/peoplefollowing", validateUserSession);
router.get("/:id/usersfollowing", validateUserSession);
router.get("/:id/watchlist", validateUserSession);
router.get("/:id/reviews", validateUserSession);
router.put("/:id/peoplefollowing"); //i got lazy here but you can fill in the functions as you go.
router.put("/:id/usersfollowing");
router.put("/:id/watchlist");
router.get("/:id/reviews", populateReviewIds, sendReviews);
*/

let watchlist = [{"id": "6", "title": "Force Awakens"}, {"id": "43", "title": "Split"}, {"id": "45", "title": "To All The Boys"},
{"id": "654", "title": "The Ugly Truth"}, {"id": "12", "title": "V for Vendetta"}, {"id": "64", "title": "Bleach"}];
router.post("/logout", logoutUser);
router.get("/:id", sendUser);
router.post("/login", loginUser);
router.post("/signup", createUser, loginUser)
router.put("/:id/accountType", changeAccountType); //this needs to be a put
router.get("/:id/accountType", sendAccountType);
//we will find the user
router.param("id", function(req, res, next, value){
    User.findById(value, function(err, result){
  		if(err || !result){
  			console.log(err);
  			res.sendStatus(404);   //404 Not Found
  			return;
  		}
      //need to add nested population for notifications as well
      User.findById(value).populate("usersFollowing peopleFollowing followers watchlist").populate({path: "reviews", populate: {path: "movieId",  select: 'title'}}).exec(function(err, result){
          if(err){
            throw err;
            res.sendStatus(500);
            //500 Internal Server Error
            //the server can't populate the data that it has already verified, making it a server error.
          }
          req.user = result;
          console.log(result);
          //error codes here check if empty, blah blah blah blah.
          next();
      });
    });
});


function createUser(req, res, next){
  if(!req.session.loggedin){
    if(!req.body.username || !req.body.password){
      res.sendStatus(400); //400 Bad Request no body
    }
    else{
      console.log(req.body);
      //Create a new user document using the Mongoose model
      //Copy over the required basic user data
      let newUser = new User();
      newUser._id = mongoose.Types.ObjectId();
      newUser.username = req.body.username;
      newUser.password = req.body.password;
      newUser.accountType = false; //make them basic users by default
      newUser.save(function(err, user) {
        if (err) {
          if(err.code == 11000){ //this is duplicate-key error (someone already exists with that name)
            res.sendStatus(409); //409 is the correct status code for duplicate resource or resource already exists.
            //it means conflict
          }
          else{
            console.log(err);
            res.sendStatus(400); //Bad request, the data send by the client failed to get verified and added.
          }
        }
        else{
          next();
        }
      });
    }
  }
  else{
    res.sendStatus(403); //403 Forbidden
    //The request contained valid data and was understood by the server,
    //but the server is refusing action. This may be due to the user not having the necessary permissions for a
    //resource or needing an account of some sort, or attempting a prohibited action
    // (e.g. creating a duplicate record where only one is allowed).
    //Zara ->such as making an account when already logged in for our case
  }
}




function loginUser(req, res, next){
  if(!req.session.loggedin){
    if(!req.body.username || !req.body.password){
      res.sendStatus(400); //400 Bad Request no body
    }
    else{
      User.findByUsername(req.body.username, function(err, results){
        if (err || !results) {
            console.log(err);
            res.sendStatus(404);
            //404 Not Found
        }
        else{
          console.log(results);
          if (req.body.password === results.password){
            req.user = results;
            req.session.username = results.username;
            req.session.loggedin = true;
            req.session.admin = results.accountType;
            req.session.userID = results._id;
            res.status(200).send(req.user);
          }
          else{
            res.sendStatus(403);
            //403 forbidden, the server understood the request, but is refusing to fulfill it.
          }
        }
      });
    }
  }
  else{
    res.sendStatus(403); //403 Forbidden
    //The request contained valid data and was understood by the server,
    //but the server is refusing action. This may be due to the user not having the necessary permissions for a
    //resource or needing an account of some sort, or attempting a prohibited action
    // (e.g. creating a duplicate record where only one is allowed).
    //Zara ->such as making an account when already logged in for our case
  }
}




function logoutUser(req, res, next){
  req.session.destroy();
  res.status(200).redirect("/")
}




function sendUser(req, res, next){
  if(req.session.loggedin){
      console.log(req.session);
      res.format({
  		"application/json": function(){
  			res.status(200).json(req.user);
  		},
  		"text/html": () => {
        if(req.session.username === req.user.username){
          res.render('./primaries/userprofile', {user: req.user, recommendedMovies: watchlist, session:req.session});
        }
        else{
          res.render('./primaries/viewingusers', {user: req.user, recommendedMovies: watchlist, session:req.session});
        }
      }
  	});
  }
  else{
    res.status(401).redirect("/");
    //Similar to 403 Forbidden, but specifically for use when authentication is required and has failed or has not yet been provided.
  }
}

function sendAccountType(req, res, next){
  if(req.session.loggedin){
    if(req.session.username === req.user.username){
      res.setHeader('content-type', 'application/json');
      res.status(200).send({"accountType": req.user.accountType});
    }
    else{
      res.sendStatus(403);
      //403 forbidden, the server understood the request, but is refusing to fulfill it.
    }
  }
  else{
    res.sendStatus(401);
    //Similar to 403 Forbidden, but specifically for use when authentication is required and has failed or has not yet been provided.
  }
}

function changeAccountType(req, res, next){
  if(req.session.loggedin){
    if(req.session.username === req.user.username){
      req.user.accountType = req.body.accountType;
      req.user.save(function(err, user) {
          if (err) {
            if(err.name === 'ValidationError'){
              res.sendStatus(400); //Bad request, the data send by the client failed to get verified and added.
            }
            else{
              res.sendStatus(500);
              //500 Internal Server Error
              //A generic error message, given when an unexpected condition was
              //encountered and no more specific message is suitable.
            }
          }
          else{
            req.session.admin = req.user.accountType;
            res.status(200).send({"accountType": req.user.accountType});
          }
        });
    }
    else{
      res.sendStatus(403);
      //403 forbidden, the server understood the request, but is refusing to fulfill it.
    }
  }
  else{
    res.sendStatus(401);
    //Similar to 403 Forbidden, but specifically for use when authentication is required and has failed or has not yet been provided.
  }
}
//now create the functions above! Look at the store-server if confused. Those functions above are just examples btw.

//Export the router so it can be mounted in the main app
module.exports = router;
