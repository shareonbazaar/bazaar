const request = require('supertest');
const app = require('../app.js');

describe('GET /api/users', () => {
  it('should return 200 OK', (done) => {
    request(app)
      .get('/api/users')
      .expect('Content-Type', /json/)
      .expect(200)
      .expect(function (res) {
        if (!(res.body instanceof Array)) {
          throw new Error("Returned data is not an array");
        }
      })
      .end(done)
  });
});

describe('GET /api/users with a skills query', () => {
  it('should return 200 OK', (done) => {
    request(app)
      .get('/api/users')
      .query('skills%5B%5D=wrestling&skills%5B%5D=boxing')
      .expect('Content-Type', /json/)
      .expect(200)
      .expect(function (res) {
        if (!(res.body instanceof Array)) {
          throw new Error("Returned data is not an array");
        }
      })
      .end(done)
  });
});

describe('GET /api/users with a skills query and distance', () => {
  it('should return 200 OK', (done) => {
    request(app)
      .get('/api/users')
      .query('skills%5B%5D=wrestling&skills%5B%5D=boxing&distance=5&latitude=42&longitude=12')
      .expect('Content-Type', /json/)
      .expect(200)
      .expect(function (res) {
        if (!(res.body instanceof Array)) {
          throw new Error("Returned data is not an array");
        }
      })
      .end(done)
  });
});

describe('GET /api/users with missing longitude', () => {
  it('should return 400 Bad Request', (done) => {
    request(app)
      .get('/api/users')
      .query('skills%5B%5D=wrestling&skills%5B%5D=boxing&distance=5&latitude=42')
      .expect('Content-Type', /json/)
      .expect(400)
      .end(done)
  });
});

describe('GET /api/users with missing distance', () => {
  it('should return 400 Bad Request', (done) => {
    request(app)
      .get('/api/users')
      .query('skills%5B%5D=wrestling&skills%5B%5D=boxing&latitude=-42&longitude=12')
      .expect('Content-Type', /json/)
      .expect(400)
      .end(done)
  });
});

describe('GET /api/users with wrong latitude type', () => {
  it('should return 400 Bad Request', (done) => {
    request(app)
      .get('/api/users')
      .query('skills%5B%5D=wrestling&skills%5B%5D=boxing&latitude=hello&longitude=12')
      .expect('Content-Type', /json/)
      .expect(400)
      .end(done)
  });
});

describe('GET /api/users with no skills specified', () => {
  it('should return 400 Bad Request', (done) => {
    request(app)
      .get('/api/users')
      .query('latitude=40&longitude=12&distance=5')
      .expect('Content-Type', /json/)
      .expect(400)
      .end(done)
  });
});

describe('GET /api/users with negative distance', () => {
  it('should return 400 Bad Request', (done) => {
    request(app)
      .get('/api/users')
      .query('skills%5B%5D=wrestling&latitude=40&longitude=12&distance=-5')
      .expect('Content-Type', /json/)
      .expect(400)
      .end(done)
  });
});
