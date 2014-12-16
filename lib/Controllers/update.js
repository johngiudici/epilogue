"use strict";

var _ = require('lodash'),
    util = require('util'),
    Base = require('./base');

var Update = function(args) {
  if (args.resource.updateMethod)
    this.method = args.resource.updateMethod;
  Update.super_.call(this, args);
};

util.inherits(Update, Base);

Update.prototype.action = 'update';
Update.prototype.method = 'put';
Update.prototype.plurality = 'singular';

Update.prototype.fetch = function(req, res, context) {
  var model = this.model;
  var endpoint = this.endpoint;
  var criteria = context.criteria;

  endpoint.attributes.forEach(function(attribute) {
    criteria[attribute] = req.params[attribute];
  });

  model
    .find({ where: criteria })
    .success(function(instance) {
      if (!instance) {
        res.status(404);
        context.error = { error: "not found" };
        return context.continue();
      }
      
      context.instance = instance;
      context.continue();
    })
    .error(function(err) {
      res.status(500);
      context.error = { error: err };
      return context.continue();
    });
};

Update.prototype.write = function(req, res, context) {
  if (context.error !== undefined) {
    return context.skip();
  }

  var instance = context.instance;
  _(context.attributes).extend(_(req.body).clone());

  this.endpoint.attributes.forEach(function(a) {
    if (req.params.hasOwnProperty(a))
      context.attributes[a] = req.params[a];
  });

  instance.setAttributes(context.attributes);

  var save = function (err) {
    instance
      .save()
      .success(function(instance) {
        context.instance = instance;
        context.continue();
      })
      .error(function(err) {
        res.status(500);
        context.error = { error: err };
        return context.continue();
      });
  };

  var validation = instance.hookValidate();
  validation
    .success(function(validatedInstance) {
      instance = validatedInstance;
      save();
    })
    .error(function(err) {
      context.error = { error: err };
      if (validation.fct) {
        // sequelize 1.x
        res.status(400);
      } else {
        // sequelize 2.x
        if (err.hasOwnProperty('name') && err.name === 'SequelizeValidationError') {
          res.status(400);
        } else {
          res.status(500);
        }
      }
      context.continue();
    });
};

module.exports = Update;
