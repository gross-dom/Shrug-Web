import { Component, Fragment, type ReactNode } from 'react'

// Keeps a failure where it happened. Without one, an error thrown while one
// window or app is drawing takes the whole page down with it.

interface Props {
  children: ReactNode
  /** Told when something inside has failed. */
  onError?: (error: unknown) => void
  /** Drawn in place of what failed; `retry` draws it afresh. With none, nothing is drawn. */
  fallback?: (retry: () => void) => ReactNode
}

export class Boundary extends Component<Props, { failed: boolean; attempt: number }> {
  state = { failed: false, attempt: 0 }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.error(error)
    this.props.onError?.(error)
  }

  retry = () => this.setState((s) => ({ failed: false, attempt: s.attempt + 1 }))

  render() {
    if (this.state.failed) return this.props.fallback?.(this.retry) ?? null
    return <Fragment key={this.state.attempt}>{this.props.children}</Fragment>
  }
}
