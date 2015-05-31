'use strict';

var request = require('request'),
    expect = require('chai').expect,
    _ = require('lodash'),
    rest = require('../../lib'),
    test = require('../support'),
    Promise = require('bluebird');

describe('Resource(search)', function() {
  describe('Basic', function() {
    before(function() {
      test.models.User = test.db.define('users', {
        id: { type: test.Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        username: {
          type: test.Sequelize.STRING,
          allowNull: false
        },
        email: {
          type: test.Sequelize.STRING,
          unique: { msg: 'must be unique' },
          validate: { isEmail: true }
        }
      }, {
        underscored: true,
        timestamps: false
      });

      test.userlist = [
        { username: 'arthur', email: 'arthur@gmail.com' },
        { username: 'james', email: 'james@gmail.com' },
        { username: 'james', email: 'jim@gmail.com' },
        { username: 'henry', email: 'henry@gmail.com' },
        { username: 'william', email: 'william@gmail.com' },
        { username: 'edward', email: 'edward@gmail.com' },
        { username: 'arthur', email: 'aaaaarthur@gmail.com' }
      ];
    });

    beforeEach(function(done) {
      test.initializeDatabase(function() {
        test.initializeServer(function() {
          rest.initialize({
            app: test.app,
            sequelize: test.Sequelize
          });

          return test.models.User.bulkCreate(test.userlist).then(function() {
            done();
          });
        });
      });
    });

    afterEach(function(done) {
      test.clearDatabase(function() {
        test.server.close(done);
      });
    });

    [
      {
        name: 'with default options',
        config: {},
        query: 'gmail.com',
        expectedResults: [
          { username: 'arthur', email: 'arthur@gmail.com' },
          { username: 'james', email: 'james@gmail.com' },
          { username: 'james', email: 'jim@gmail.com' },
          { username: 'henry', email: 'henry@gmail.com' },
          { username: 'william', email: 'william@gmail.com' },
          { username: 'edward', email: 'edward@gmail.com' },
          { username: 'arthur', email: 'aaaaarthur@gmail.com' }
        ]
      },
      {
        name: 'with custom search attributes',
        config: {
          search: {
            attributes: [ 'username' ]
          }
        },
        query: 'gmail.com',
        expectedResults: []
      },
      {
        name: 'with custom search param',
        config: {
          search: {
            param: 'search'
          }
        },
        query: 'william',
        expectedResults: [{ username: 'william', email: 'william@gmail.com' }]
      },
      {
        name: 'with a named parameter',
        config: {},
        query: 'email:james',
        expectedResults: [{ username: 'james', email: 'james@gmail.com'}]
      }
    ].forEach(function(testCase) {

      it('should search ' + testCase.name, function(done) {
        rest.resource(_.extend(testCase.config, {
          model: test.models.User,
          endpoints: ['/users', '/users/:id']
        }));

        var searchParam =
          testCase.config.search ? testCase.config.search.param || 'q' : 'q';
        request.get({
          url: test.baseUrl + '/users?' + searchParam + '=' + testCase.query
        }, function(err, response, body) {
          expect(response.statusCode).to.equal(200);
          var records = JSON.parse(body).map(function(r) { delete r.id; return r; });
          expect(records).to.eql(testCase.expectedResults);
          done();
        });
      });

    });
  });

  describe('Associations', function() {
    before(function() {
      test.models.Student = test.db.define('student', {
        id: { type: test.Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        name: {
          type: test.Sequelize.STRING,
          allowNull: false
        },
        underscored: true,
        timestamps: false
      });

      test.models.Course = test.db.define('course', {
        id: { type: test.Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        name: {
          type: test.Sequelize.STRING,
          allowNull: false
        },
        underscored: true,
        timestamps: false
      });

      test.models.RequiredTextbook = test.db.define('requiredTextbook', {
        id: { type: test.Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        name: {
          type: test.Sequelize.STRING,
          allowNull: false
        },
        underscored: true,
        timestamps: false
      });

      test.models.Student.belongsToMany(test.models.Course, { through: 'course_student' });
      test.models.Course.belongsToMany(test.models.Student, { through: 'course_student' });
      test.models.Course.hasMany(test.models.RequiredTextbook);
      test.models.RequiredTextbook.belongsTo(test.models.Course);

      test.studentList = [
        { name: 'John Public' },
        { name: 'Joe Smith' },
        { name: 'Jane Smith' }
      ];

      test.courseList = [
        { name: 'math' },
        { name: 'science' }
      ];

      test.requiredTextbookList = [
        { name: 'algebra' },
        { name: 'geometry' },
        { name: 'intro to biology' }
      ];
    });

    beforeEach(function(done) {
      test.initializeDatabase(function() {
        test.initializeServer(function() {
          rest.initialize({
            app: test.app,
            sequelize: test.Sequelize
          });

          rest.resource({
            model: test.models.Student,
            endpoints: ['/student', '/student/:id'],
            include: [{
              model: test.models.Course,
              include: [{ 
                model: test.models.RequiredTextbook
              }]
            }]
          });

          var students, courses, requiredTextbooks;

          return test.models.Student.bulkCreate(test.studentList)
            .then(function() {
              return test.models.Student.findAll();
            }).then(function(instances) {
              students = instances;
              return test.models.Course.bulkCreate(test.courseList);
            }).then(function(instances) {
              return test.models.Course.findAll();
            }).then(function(instances) {
              courses = instances;
              return test.models.RequiredTextbook.bulkCreate(test.requiredTextbookList);
            }).then(function() {
              return test.models.RequiredTextbook.findAll();
            }).then(function(instances) {
              requiredTextbooks = instances;
              return Promise.all([
                students[0].setCourses([courses[0]]),
                students[1].setCourses([courses[0], courses[1]]),
                students[2].setCourses([courses[1]])
              ]);
            }).then(function() {
              return Promise.all([
                requiredTextbooks[0].setCourse(courses[0]),
                requiredTextbooks[1].setCourse(courses[0]),
                requiredTextbooks[2].setCourse(courses[1])
              ]);
            }).then(function() {
              done();
            });
        });
      });
    });

    afterEach(function(done) {
      test.clearDatabase(function() {
        test.server.close(done);
      });
    });

    it('should search one association deep', function(done) {
      request.get({
        url: test.baseUrl + '/student?q=course.name:science'
      }, function(error, response, body) {
        expect(response.statusCode).to.equal(200);
        var records = JSON.parse(body);
        expect(records.length).to.equal(2);
        expect(records[0].courses[0].name).to.equal('science');
        expect(records[1].courses[0].name).to.equal('science');
        expect(records[0].id).to.not.equal(records[1].id);
        done();
      });
    });

    it('should search nested associations', function(done) {
      request.get({
        url: test.baseUrl + '/student?q=course.requiredTextbook.name:algebra'
      }, function(error, response, body) {
        expect(response.statusCode).to.equal(200);
        var records = JSON.parse(body);
        expect(records.length).to.equal(2);
        expect(records[0].Course.RequiredTextbook.name).to.equal('algebra');
        expect(records[1].Course.RequiredTextbook.name).to.equal('algebra');
        expect(records[0].id).to.not.equal(records[1].id);
        done();
      });
    });

    it('should search local and associated fields', function(done) {
      request.get({
        url: test.baseUrl + '/student?q=course.name:science&q=Jane'
      }, function(error, response, body) {
        expect(response.statusCode).to.equal(200);
        var records = JSON.parse(body);
        expect(records.length).to.equal(1);
        expect(records[0].name).to.equal('Jane Smith');
        expect(records[0].courses[0].name).to.equal('science');
        done();
      });
    });

    it('should search multiple associated fields', function(done) {
      done();
    });

  });

});
