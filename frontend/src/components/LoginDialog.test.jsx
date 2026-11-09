import {cleanup, fireEvent, render, screen} from '@testing-library/react'
import {afterEach, beforeEach, expect, it, vi} from 'vitest'
import LoginDialog from './LoginDialog'

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true }
  HTMLDialogElement.prototype.close = function () {
    this.open = false
    this.dispatchEvent(new Event('close'))
  }
})

afterEach(cleanup)

it('uses the shared header to close without starting login', () => {
  const onClose = vi.fn()
  const onGoogleLogin = vi.fn()
  render(<LoginDialog onClose={onClose} onGoogleLogin={onGoogleLogin} />)
  expect(screen.queryByRole('button', {name: 'Keep browsing'})).toBeNull()
  expect(screen.getByRole('button', {name: 'Continue with Google'})).toBeTruthy()
  const close = screen.getByRole('button', {name: 'Close login'})
  expect(close.closest('.dialog-header')).toBeTruthy()
  expect(close.title).toBe('Close login')
  fireEvent.click(close)
  expect(onClose).toHaveBeenCalledTimes(1)
  expect(onGoogleLogin).not.toHaveBeenCalled()
})
