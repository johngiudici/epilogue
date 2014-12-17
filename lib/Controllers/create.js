"use strict";

var _ = require('lodash'),
    util = require('util'),
    Base = require('./base');

var Create = function(args) {
  Create.super_.call(this, args);
};

util.inherits(Create, Base);

Create.prototype.action = 'create';
Create.prototype.method = 'post';
Create.prototype.plurality = 'plural';

Create.prototype.write = function(req, res, context) {
  if (context.error !== undefined) {
    return context.skip();
  }

  var model = this.model;
  _(context.attributes).extend(_(req.body).clone());

  this.endpoint.attributes.forEach(function(a) {
    if (req.params.hasOwnProperty(a))
      context.attributes[a] = req.params[a];
  });

  var instance = model.build(context.attributes);
  var resource = this.resource;

  var save = function() {
    instance
      .save()
      .success(function(instance) {
        if (resource) {
          var endpoint = resource.endpoints.singular;
          var location = endpoint.replace(/:(\w+)/g, function(match, $1) { return instance[$1]; });
          res.header('Location', location);
        }

        res.status(201);
        context.instance = instance;
        context.continue();
      })
      .error(function(err) {
        context.error = { error: err };
        res.status(500);
        return context.skip();
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

module.exports = Create;
