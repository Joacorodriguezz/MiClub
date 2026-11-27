import type { NextFunction, Request, RequestHandler, Response } from 'express';

/** Express 4 no captura errores de handlers async: esto los manda al error handler. */
export function asyncHandler(
  fn: (req: Request, res: Response) => Promise<void>,
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };
}
