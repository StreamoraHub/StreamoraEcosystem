export class SigningEngine {
  private keyPairPromise: Promise<CryptoKeyPair>

  constructor() {
    this.keyPairPromise = crypto.subtle.generateKey(
      {
        name: "RSASSA-PKCS1-v1_5",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["sign", "verify"]
    )
  }

  /** Ensure key pair is available */
  private async getKeyPair(): Promise<CryptoKeyPair> {
    return this.keyPairPromise
  }

  /** Sign a string payload and return base64 signature */
  async sign(data: string): Promise<string> {
    const { privateKey } = await this.getKeyPair()
    const enc = new TextEncoder().encode(data)
    const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", privateKey, enc)
    return Buffer.from(sig).toString("base64")
  }

  /** Verify a payload against a base64 signature */
  async verify(data: string, signature: string): Promise<boolean> {
    const { publicKey } = await this.getKeyPair()
    const enc = new TextEncoder().encode(data)
    const sig = Buffer.from(signature, "base64")
    return crypto.subtle.verify("RSASSA-PKCS1-v1_5", publicKey, sig, enc)
  }

  /** Export public key in PEM format */
  async exportPublicKey(): Promise<string> {
    const { publicKey } = await this.getKeyPair()
    const spki = await crypto.subtle.exportKey("spki", publicKey)
    const b64 = Buffer.from(spki).toString("base64")
    return this.wrapPem(b64, "PUBLIC KEY")
  }

  /** Export private key in PEM format */
  async exportPrivateKey(): Promise<string> {
    const { privateKey } = await this.getKeyPair()
    const pkcs8 = await crypto.subtle.exportKey("pkcs8", privateKey)
    const b64 = Buffer.from(pkcs8).toString("base64")
    return this.wrapPem(b64, "PRIVATE KEY")
  }

  private wrapPem(b64: string, label: string): string {
    const chunks = b64.match(/.{1,64}/g) ?? []
    return `-----BEGIN ${label}-----\n${chunks.join("\n")}\n-----END ${label}-----`
  }
}
