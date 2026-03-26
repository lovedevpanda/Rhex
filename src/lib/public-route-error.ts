export class PublicRouteError extends Error {
  statusCode: number

  constructor(message: string, statusCode = 400) {
    super(message)
    this.name = "PublicRouteError"
    this.statusCode = statusCode
  }
}

export function isPublicRouteError(error: unknown): error is PublicRouteError {
  return error instanceof PublicRouteError
}
