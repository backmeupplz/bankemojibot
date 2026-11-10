import { expect, test } from 'bun:test'
import { START, openBank } from './bank'

test('reaction gifts move coins once, never below zero', () => {
  const b = openBank(':memory:')
  b.seen(1, 'Ann')
  b.seen(2, 'Bob')
  b.remember(-100, 7, 2)
  expect(b.author(-100, 7)).toBe(2)
  expect(b.transfer(1, 2, 25, [-100, 7, '🏆'])).toBe('ok')
  expect(b.transfer(1, 2, 25, [-100, 7, '🏆'])).toBe('again') // re-added reaction
  expect(b.transfer(1, 1, 5)).toBe('self')
  expect(b.transfer(1, 2, START)).toBe('broke')
  expect([b.balance(1), b.balance(2)]).toEqual([START - 25, START + 25])
  expect(b.top()[0]).toEqual({ name: 'Bob', balance: START + 25 })
  expect(b.top(-100)).toEqual([{ name: 'Bob', balance: START + 25 }])
  // someone the bot never saw still gets their starting coins
  expect(b.transfer(3, 1, 10)).toBe('ok')
  expect(b.balance(3)).toBe(START - 10)
})
