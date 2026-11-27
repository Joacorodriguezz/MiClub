export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export class UnauthorizedError extends HttpError {
  constructor() {
    super(401, 'No autorizado');
  }
}

export class BadRequestError extends HttpError {
  constructor() {
    super(400, 'Organización inválida');
  }
}

export class ForbiddenError extends HttpError {
  constructor() {
    super(403, 'Sin acceso');
  }
}

export class AuthUnavailableError extends HttpError {
  constructor() {
    super(503, 'Auth no configurada');
  }
}
