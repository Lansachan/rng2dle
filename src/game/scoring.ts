export function isPrime(n: number): boolean {
  if (n < 2) return false
  for (let i = 2; i * i <= n; i++) {
    if (n % i === 0) return false
  }
  return true
}

export function maxRun(digits: number[]): number {
  let best = 1
  let current = 1
  for (let i = 1; i < digits.length; i++) {
    current = digits[i] === digits[i - 1] ? current + 1 : 1
    best = Math.max(best, current)
  }
  return best
}
