import type { ApplicationContract } from '@ioc:Adonis/Core/Application'

export default class CartaDriverProvider {
  constructor(protected app: ApplicationContract) {}

  public async boot() {
    const Ally = this.app.container.resolveBinding('Adonis/Addons/Ally')
    const { CartaDriver } = await import('../src/Carta')

    Ally.extend('carta', (_, __, config, ctx) => {
      return new CartaDriver(ctx, config)
    })
  }
}
