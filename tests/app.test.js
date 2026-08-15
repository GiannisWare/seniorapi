import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Readable, Writable } from 'node:stream';

const loggerMock = {
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
};

const securityMiddlewareMock = {
  securityMiddleware: (_req, _res, next) => next(),
};

const authServiceMock = {
  authenticateUser: jest.fn(),
  createUser: jest.fn(),
};

const usersServiceMock = {
  deleteUser: jest.fn(),
  getAllUsers: jest.fn(),
  getUserById: jest.fn(),
  updateUser: jest.fn(),
};

const jwtMock = {
  jwttoken: {
    sign: jest.fn(),
    verify: jest.fn(),
  },
};

jest.unstable_mockModule('#config/logger.js', () => ({
  default: loggerMock,
}));

jest.unstable_mockModule('#utils/logger.js', () => ({
  default: loggerMock,
}));

jest.unstable_mockModule(
  '../src/middleware/security.middleware.js',
  () => securityMiddlewareMock
);
jest.unstable_mockModule(
  '../src/services/auth.service.js',
  () => authServiceMock
);
jest.unstable_mockModule(
  '../src/services/users.service.js',
  () => usersServiceMock
);
jest.unstable_mockModule('../src/utils/jwt.js', () => jwtMock);

const { default: app } = await import('../src/app.js');
const { signup, signIn, signOut } =
  await import('../src/controllers/auth.controller.js');
const { authenticateToken, requireRole } =
  await import('../src/middleware/auth.middleware.js');
const {
  deleteUser: deleteUserController,
  fetchAllUsers,
  getUserById,
  updateUser,
} = await import('../src/controllers/users.controller.js');

const adminToken = 'admin-token';
const userToken = 'user-token';
const selfToken = 'self-token';
const otherToken = 'other-token';

const baseUser = {
  id: 2,
  name: 'Jane Doe',
  email: 'jane@example.com',
  role: 'user',
};

const adminUser = {
  id: 1,
  name: 'Admin User',
  email: 'admin@example.com',
  role: 'admin',
};

function buildRequest({ method, path, body, cookie }) {
  const payload = body === undefined ? null : JSON.stringify(body);
  const request = new Readable({
    read() {
      if (payload === null) {
        this.push(null);
        return;
      }

      this.push(payload);
      this.push(null);
    },
  });

  request.method = method;
  request.url = path;
  request.originalUrl = path;
  request.headers = {
    host: 'localhost',
    ...(cookie ? { cookie } : {}),
  };

  if (payload !== null) {
    request.headers['content-type'] = 'application/json';
    request.headers['content-length'] = Buffer.byteLength(payload);
  }

  request.socket = {
    encrypted: false,
    remoteAddress: '127.0.0.1',
    destroy: () => {},
  };
  request.connection = request.socket;

  return request;
}

function buildResponse() {
  let resolve;
  let reject;

  const completed = new Promise((done, fail) => {
    resolve = done;
    reject = fail;
  });

  const res = new Writable({
    write(chunk, _encoding, callback) {
      if (chunk !== undefined) {
        res.body = `${res.body ?? ''}${chunk}`;
      }
      callback();
    },
  });

  res.statusCode = 200;
  res.headers = {};
  res.body = undefined;
  res.finished = false;
  res.headersSent = false;

  const finish = () => {
    if (res.finished) {
      return;
    }

    res.finished = true;
    res.headersSent = true;
    resolve({
      statusCode: res.statusCode,
      headers: res.headers,
      body: res.body,
    });
  };

  res.once('finish', finish);

  res.setHeader = (name, value) => {
    res.headers[name.toLowerCase()] = value;
  };

  res.getHeader = name => res.headers[name.toLowerCase()];

  res.getHeaders = () => res.headers;

  res.removeHeader = name => {
    delete res.headers[name.toLowerCase()];
  };

  res.writeHead = (statusCode, headers = {}) => {
    res.statusCode = statusCode;
    for (const [name, value] of Object.entries(headers)) {
      res.setHeader(name, value);
    }
    return res;
  };

  res.status = statusCode => {
    res.statusCode = statusCode;
    return res;
  };

  res.write = chunk => {
    res.body = `${res.body ?? ''}${chunk}`;
    return true;
  };

  res.end = chunk => {
    if (chunk !== undefined) {
      res.body = chunk;
    }
    return Writable.prototype.end.call(res, chunk);
  };

  res.send = payload => {
    res.body = payload;
    return res.end();
  };

  res.json = payload => {
    res.headers['content-type'] = 'application/json; charset=utf-8';
    res.body = payload;
    return res.end();
  };

  res.cookie = (name, value, options = {}) => {
    const cookieParts = [`${name}=${value}`];

    if (options.maxAge !== undefined) {
      cookieParts.push(`Max-Age=${Math.floor(options.maxAge / 1000)}`);
    }

    if (options.expires) {
      cookieParts.push(`Expires=${new Date(options.expires).toUTCString()}`);
    }

    if (options.httpOnly) {
      cookieParts.push('HttpOnly');
    }

    if (options.sameSite) {
      cookieParts.push(`SameSite=${options.sameSite}`);
    }

    if (options.secure) {
      cookieParts.push('Secure');
    }

    const cookieString = cookieParts.join('; ');
    const existing = res.headers['set-cookie'];

    if (!existing) {
      res.headers['set-cookie'] = [cookieString];
    } else {
      existing.push(cookieString);
    }

    return res;
  };

  res.clearCookie = (name, options = {}) => {
    return res.cookie(name, '', {
      ...options,
      expires: new Date(0),
      maxAge: 0,
    });
  };

  res.reject = reject;
  res.completed = completed;

  return res;
}

async function dispatch({ body, cookie, method, path }) {
  const request = buildRequest({ body, cookie, method, path });
  const res = buildResponse();

  app.handle(request, res, error => {
    if (error) {
      res.reject(error);
    }
  });

  return res.completed;
}

function createControllerRequest({
  body = undefined,
  cookies = {},
  params = {},
} = {}) {
  return {
    body,
    cookies,
    params,
  };
}

function createControllerResponse() {
  return {
    body: undefined,
    cookies: [],
    finished: false,
    headers: {},
    statusCode: 200,
    clearCookie(name, options = {}) {
      const cookieParts = [`${name}=`];

      if (options.maxAge !== undefined) {
        cookieParts.push(`Max-Age=${Math.floor(options.maxAge / 1000)}`);
      }

      if (options.expires) {
        cookieParts.push(`Expires=${new Date(options.expires).toUTCString()}`);
      }

      if (options.httpOnly) {
        cookieParts.push('HttpOnly');
      }

      if (options.sameSite) {
        cookieParts.push(`SameSite=${options.sameSite}`);
      }

      if (options.secure) {
        cookieParts.push('Secure');
      }

      this.cookies.push(cookieParts.join('; '));
      this.headers['set-cookie'] = this.cookies;
      return this;
    },
    cookie(name, value, options = {}) {
      const cookieParts = [`${name}=${value}`];

      if (options.maxAge !== undefined) {
        cookieParts.push(`Max-Age=${Math.floor(options.maxAge / 1000)}`);
      }

      if (options.expires) {
        cookieParts.push(`Expires=${new Date(options.expires).toUTCString()}`);
      }

      if (options.httpOnly) {
        cookieParts.push('HttpOnly');
      }

      if (options.sameSite) {
        cookieParts.push(`SameSite=${options.sameSite}`);
      }

      if (options.secure) {
        cookieParts.push('Secure');
      }

      this.cookies.push(cookieParts.join('; '));
      this.headers['set-cookie'] = this.cookies;
      return this;
    },
    getHeader(name) {
      return this.headers[name.toLowerCase()];
    },
    json(payload) {
      this.body = payload;
      this.finished = true;
      return this;
    },
    removeHeader(name) {
      delete this.headers[name.toLowerCase()];
      return this;
    },
    send(payload) {
      this.body = payload;
      this.finished = true;
      return this;
    },
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
  };
}

async function invokeMiddleware(
  middleware,
  req,
  res = createControllerResponse()
) {
  await new Promise((resolve, reject) => {
    try {
      const maybePromise = middleware(req, res, error => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });

      if (maybePromise && typeof maybePromise.then === 'function') {
        maybePromise.then(resolve).catch(reject);
        return;
      }

      if (res.finished) {
        resolve();
      }
    } catch (error) {
      reject(error);
    }
  });

  return res;
}

async function invokeController(
  controller,
  req,
  res = createControllerResponse()
) {
  await controller(req, res, () => {});
  return res;
}

beforeEach(() => {
  jwtMock.jwttoken.sign.mockImplementation(
    payload => `signed:${payload.id}:${payload.role}`
  );
  jwtMock.jwttoken.verify.mockImplementation(token => {
    switch (token) {
      case adminToken:
        return adminUser;
      case userToken:
      case selfToken:
        return baseUser;
      case otherToken:
        return {
          id: 3,
          name: 'Other User',
          email: 'other@example.com',
          role: 'user',
        };
      default:
        throw new Error('Unable to authenticate the token');
    }
  });

  authServiceMock.createUser.mockResolvedValue({
    id: 10,
    name: 'John Giotis',
    email: 'john@example.com',
    role: 'user',
  });

  authServiceMock.authenticateUser.mockResolvedValue({
    id: 10,
    name: 'John Giotis',
    email: 'john@example.com',
    role: 'user',
  });

  usersServiceMock.getAllUsers.mockResolvedValue([adminUser, baseUser]);
  usersServiceMock.getUserById.mockResolvedValue(baseUser);
  usersServiceMock.updateUser.mockResolvedValue({
    ...baseUser,
    name: 'Jane Updated',
  });
  usersServiceMock.deleteUser.mockResolvedValue(baseUser);
});

describe('API endpoints', () => {
  describe('Public routes', () => {
    it('GET /health returns health status', async () => {
      const response = await dispatch({ method: 'GET', path: '/health' });

      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('status', 'OK');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
    });

    it('GET /api returns api message', async () => {
      const response = await dispatch({ method: 'GET', path: '/api' });

      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('message', 'My api is running!');
    });

    it('GET /nonexistent returns the app 404 payload', async () => {
      const response = await dispatch({ method: 'GET', path: '/nonexistent' });

      expect(response.statusCode).toBe(404);
      expect(response.body).toEqual({ error: 'Not Found' });
    });
  });

  describe('Auth routes', () => {
    it('POST /api/auth/sign-up returns 201 and sets a token cookie', async () => {
      const response = await invokeController(
        signup,
        createControllerRequest({
          body: {
            name: 'John Giotis',
            email: 'john@example.com',
            password: 'password123',
            role: 'user',
          },
        })
      );

      expect(response.statusCode).toBe(201);
      expect(authServiceMock.createUser).toHaveBeenCalledWith({
        name: 'John Giotis',
        email: 'john@example.com',
        password: 'password123',
        role: 'user',
      });
      expect(response.body.message).toBe('User registered succesfully');
      expect(response.body.user).toMatchObject({
        id: 10,
        name: 'John Giotis',
        email: 'john@example.com',
        role: 'user',
      });
      expect(response.headers['set-cookie']).toBeDefined();
    });

    it('POST /api/auth/sign-up rejects invalid payloads', async () => {
      const response = await invokeController(
        signup,
        createControllerRequest({
          body: {
            name: 'J',
            email: 'not-an-email',
            password: '123',
          },
        })
      );

      expect(response.statusCode).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });

    it('POST /api/auth/sign-in returns 200 and sets a token cookie', async () => {
      const response = await invokeController(
        signIn,
        createControllerRequest({
          body: {
            email: 'john@example.com',
            password: 'password123',
          },
        })
      );

      expect(response.statusCode).toBe(200);
      expect(authServiceMock.authenticateUser).toHaveBeenCalledWith({
        email: 'john@example.com',
        password: 'password123',
      });
      expect(response.body.message).toBe('User signed in succesfully');
      expect(response.body.user).toMatchObject({
        id: 10,
        name: 'John Giotis',
        email: 'john@example.com',
        role: 'user',
      });
      expect(response.headers['set-cookie']).toBeDefined();
    });

    it('POST /api/auth/sign-in returns 401 for invalid credentials', async () => {
      authServiceMock.authenticateUser.mockRejectedValueOnce(
        new Error('Invalid password')
      );

      const response = await invokeController(
        signIn,
        createControllerRequest({
          body: {
            email: 'john@example.com',
            password: 'wrong-password',
          },
        })
      );

      expect(response.statusCode).toBe(401);
      expect(response.body).toEqual({ error: 'Invalid password' });
    });

    it('POST /api/auth/sign-out clears the token cookie', async () => {
      const response = await invokeController(
        signOut,
        createControllerRequest({
          cookies: {
            token: userToken,
          },
        })
      );

      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual({ message: 'User signed out succesfully' });
      expect(response.headers['set-cookie']).toBeDefined();
      expect(response.headers['set-cookie'][0]).toContain('token=');
    });
  });

  describe('User routes', () => {
    it('GET /api/users requires authentication', async () => {
      const response = await invokeMiddleware(
        authenticateToken,
        createControllerRequest()
      );

      expect(response.statusCode).toBe(401);
      expect(response.body).toEqual({
        error: 'Authentication required',
        message: 'No access token provided',
      });
    });

    it('GET /api/users forbids non-admin users', async () => {
      const req = createControllerRequest({
        cookies: {
          token: userToken,
        },
      });
      await invokeMiddleware(authenticateToken, req);
      const response = await invokeMiddleware(requireRole(['admin']), req);

      expect(response.statusCode).toBe(403);
      expect(response.body.error).toBe('Access denied');
    });

    it('GET /api/users returns all users for admin', async () => {
      const req = createControllerRequest({
        cookies: {
          token: adminToken,
        },
      });
      await invokeMiddleware(authenticateToken, req);
      const response = await invokeMiddleware(requireRole(['admin']), req);
      await fetchAllUsers(req, response, () => {});

      expect(response.statusCode).toBe(200);
      expect(usersServiceMock.getAllUsers).toHaveBeenCalledTimes(1);
      expect(response.body).toMatchObject({
        message: 'Successfully retrieved all users.',
        count: 2,
      });
      expect(response.body.users).toHaveLength(2);
    });

    it('GET /api/users/:id returns a user', async () => {
      const req = createControllerRequest({
        cookies: {
          token: userToken,
        },
        params: {
          id: '2',
        },
      });
      await invokeMiddleware(authenticateToken, req);
      const response = await invokeController(getUserById, req);

      expect(response.statusCode).toBe(200);
      expect(usersServiceMock.getUserById).toHaveBeenCalledWith(2);
      expect(response.body).toMatchObject({
        message: 'Successfully retrieved user.',
        user: baseUser,
      });
    });

    it('GET /api/users/:id returns 400 for invalid ids', async () => {
      const req = createControllerRequest({
        cookies: {
          token: userToken,
        },
        params: {
          id: 'not-a-number',
        },
      });
      await invokeMiddleware(authenticateToken, req);
      const response = await invokeController(getUserById, req);

      expect(response.statusCode).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });

    it('GET /api/users/:id returns 404 when the user is missing', async () => {
      usersServiceMock.getUserById.mockResolvedValueOnce(null);

      const req = createControllerRequest({
        cookies: {
          token: userToken,
        },
        params: {
          id: '999',
        },
      });
      await invokeMiddleware(authenticateToken, req);
      const response = await invokeController(getUserById, req);

      expect(response.statusCode).toBe(404);
      expect(response.body).toEqual({ error: 'User not found' });
    });

    it('PUT /api/users/:id lets a user update their own account', async () => {
      const req = createControllerRequest({
        body: {
          name: 'Jane Updated',
        },
        cookies: {
          token: selfToken,
        },
        params: {
          id: '2',
        },
      });
      await invokeMiddleware(authenticateToken, req);
      const response = await invokeController(updateUser, req);

      expect(response.statusCode).toBe(200);
      expect(usersServiceMock.updateUser).toHaveBeenCalledWith(2, {
        name: 'Jane Updated',
      });
      expect(response.body).toMatchObject({
        message: 'User updated successfully',
        user: {
          id: 2,
          name: 'Jane Updated',
          email: 'jane@example.com',
          role: 'user',
        },
      });
    });

    it('PUT /api/users/:id prevents a non-admin from editing another user', async () => {
      const req = createControllerRequest({
        body: {
          name: 'Jane Updated',
        },
        cookies: {
          token: otherToken,
        },
        params: {
          id: '2',
        },
      });
      await invokeMiddleware(authenticateToken, req);
      const response = await invokeController(updateUser, req);

      expect(response.statusCode).toBe(403);
      expect(response.body).toMatchObject({
        error: 'Forbidden',
        message: 'You can only update your own account',
      });
    });

    it('PUT /api/users/:id prevents a non-admin from changing role', async () => {
      const req = createControllerRequest({
        body: {
          role: 'admin',
        },
        cookies: {
          token: selfToken,
        },
        params: {
          id: '2',
        },
      });
      await invokeMiddleware(authenticateToken, req);
      const response = await invokeController(updateUser, req);

      expect(response.statusCode).toBe(403);
      expect(response.body).toMatchObject({
        error: 'Forbidden',
        message: 'Only admins can change roles',
      });
    });

    it("PUT /api/users/:id lets an admin change another user's role", async () => {
      const req = createControllerRequest({
        body: {
          role: 'admin',
        },
        cookies: {
          token: adminToken,
        },
        params: {
          id: '2',
        },
      });
      await invokeMiddleware(authenticateToken, req);
      const response = await invokeController(updateUser, req);

      expect(response.statusCode).toBe(200);
      expect(usersServiceMock.updateUser).toHaveBeenCalledWith(2, {
        role: 'admin',
      });
      expect(response.body).toMatchObject({
        message: 'User updated successfully',
      });
    });

    it('DELETE /api/users/:id requires an admin', async () => {
      const req = createControllerRequest({
        cookies: {
          token: userToken,
        },
        params: {
          id: '2',
        },
      });
      await invokeMiddleware(authenticateToken, req);
      const response = await invokeMiddleware(requireRole(['admin']), req);

      expect(response.statusCode).toBe(403);
      expect(response.body.error).toBe('Access denied');
    });

    it('DELETE /api/users/:id deletes a user for admin', async () => {
      const req = createControllerRequest({
        cookies: {
          token: adminToken,
        },
        params: {
          id: '2',
        },
      });
      await invokeMiddleware(authenticateToken, req);
      const response = await invokeMiddleware(requireRole(['admin']), req);
      await deleteUserController(req, response, () => {});

      expect(response.statusCode).toBe(200);
      expect(usersServiceMock.deleteUser).toHaveBeenCalledWith(2);
      expect(response.body).toMatchObject({
        message: 'User deleted successfully',
        user: baseUser,
      });
    });

    it('DELETE /api/users/:id returns 400 for invalid ids', async () => {
      const req = createControllerRequest({
        cookies: {
          token: adminToken,
        },
        params: {
          id: 'not-a-number',
        },
      });
      await invokeMiddleware(authenticateToken, req);
      const response = await invokeMiddleware(requireRole(['admin']), req);
      await deleteUserController(req, response, () => {});

      expect(response.statusCode).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });
  });
});
