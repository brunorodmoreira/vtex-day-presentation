import { FC } from 'react'

declare module 'vtex.styleguide' {
  type ButtonProps = {
    onClick: () => void
    isLoading: boolean
  }

  const Button: FC<ButtonProps>

  export { Button }
  export * from 'vtex.styleguide'
}
