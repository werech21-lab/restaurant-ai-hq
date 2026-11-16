/** Exact base-10 decimal. Rounding is half away from zero. */
export class Decimal {
  private constructor(
    readonly scaled: bigint,
    readonly scale: number,
  ) {}

  static parse(raw: string): Decimal | null {
    const match = raw.replace(/,/g, '').replace(/\s/g, '').match(/^([+-])?(\d+)(?:\.(\d+))?$/)
    if (!match) return null
    const fraction = match[3] ?? ''
    const digits = `${match[2]}${fraction}`.replace(/^0+(?=\d)/, '') || '0'
    let scaled = BigInt(digits)
    if (match[1] === '-' && scaled !== 0n) scaled = -scaled
    return new Decimal(scaled, fraction.length)
  }

  static fromParts(scaled: bigint, scale: number): Decimal {
    return new Decimal(scaled, scale)
  }

  private rescaled(scale: number): bigint {
    if (scale === this.scale) return this.scaled
    if (scale > this.scale) return this.scaled * 10n ** BigInt(scale - this.scale)
    return this.scaled / 10n ** BigInt(this.scale - scale)
  }

  add(other: Decimal): Decimal {
    const scale = Math.max(this.scale, other.scale)
    return new Decimal(this.rescaled(scale) + other.rescaled(scale), scale)
  }

  sub(other: Decimal): Decimal {
    return this.add(new Decimal(-other.scaled, other.scale))
  }

  mul(other: Decimal): Decimal {
    return new Decimal(this.scaled * other.scaled, this.scale + other.scale)
  }

  div(other: Decimal, resultScale: number): Decimal | null {
    if (other.scaled === 0n) return null
    const guard = resultScale + 4
    const numerator = this.scaled * 10n ** BigInt(guard + other.scale)
    const denominator = other.scaled * 10n ** BigInt(this.scale)
    return new Decimal(numerator / denominator, guard).roundHalfUp(resultScale)
  }

  roundHalfUp(scale: number): Decimal {
    if (scale >= this.scale) return new Decimal(this.rescaled(scale), scale)
    const factor = 10n ** BigInt(this.scale - scale)
    const negative = this.scaled < 0n
    const abs = negative ? -this.scaled : this.scaled
    const quotient = abs / factor
    const remainder = abs % factor
    const rounded = remainder * 2n >= factor ? quotient + 1n : quotient
    return new Decimal(negative ? -rounded : rounded, scale)
  }

  compare(other: Decimal): number {
    const scale = Math.max(this.scale, other.scale)
    const left = this.rescaled(scale)
    const right = other.rescaled(scale)
    if (left < right) return -1
    if (left > right) return 1
    return 0
  }

  sign(): -1 | 0 | 1 {
    if (this.scaled === 0n) return 0
    return this.scaled > 0n ? 1 : -1
  }

  canonical(): string {
    if (this.scaled === 0n) return '0'
    const negative = this.scaled < 0n
    const abs = (negative ? -this.scaled : this.scaled).toString()
    let body: string
    if (this.scale <= 0) {
      body = this.scale === 0 ? abs : abs + '0'.repeat(-this.scale)
    } else if (abs.length <= this.scale) {
      body = `0.${abs.padStart(this.scale, '0')}`
    } else {
      body = `${abs.slice(0, abs.length - this.scale)}.${abs.slice(abs.length - this.scale)}`
    }
    body = body.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')
    if (body.startsWith('.')) body = `0${body}`
    return negative ? `-${body}` : body
  }
}
