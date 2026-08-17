export class PageSinConexionError extends Error {
  constructor(public readonly pageId: string) {
    super(`page_id sin conexión activa: ${pageId}`);
    this.name = 'PageSinConexionError';
  }
}
